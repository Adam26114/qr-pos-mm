import { afterEach, expect, test, vi } from "vitest"
import { api, components } from "./_generated/api"
import { backend, authenticate } from "../test/convex"

afterEach(() => vi.useRealTimers())

test("signup rejects invalid owner names at the auth boundary and normalizes valid names", async () => {
  const t = backend()
  const email = "name-validation@example.com"
  const signup = (name: string) =>
    t.fetch("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ name, email, password: "CafePassword42!" }),
    })
  for (const name of ["", "   ", "a", "n".repeat(81)])
    expect((await signup(name)).status).toBe(400)
  const valid = await signup("  Cafe owner  ")
  expect(valid.status).toBe(200)
  expect(await valid.json()).toMatchObject({ user: { name: "Cafe owner" } })
})

test("an owner creates one store and retries do not restart its fourteen-day trial", async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-10T00:00:00Z"))
  const t = backend()
  const owner = await authenticate(t, "owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Mingalar Cafe",
  })
  vi.setSystemTime(new Date("2026-10-11T00:00:00Z"))
  expect(
    await owner.mutation(api.stores.create, { name: "Another store" })
  ).toBe(storeId)
  expect(await owner.query(api.stores.workspace)).toMatchObject({
    role: "owner",
    store: {
      _id: storeId,
      name: "Mingalar Cafe",
      trialStartedAt: Date.parse("2026-10-10T00:00:00Z"),
      trialEndsAt: Date.parse("2026-10-24T00:00:00Z"),
    },
    access: { active: true, expiresAt: Date.parse("2026-10-24T00:00:00Z") },
  })
})

test("private workspaces reject guests and never expose another owner's store", async () => {
  const t = backend()
  await expect(t.query(api.stores.workspace)).rejects.toThrow("Unauthenticated")
  await expect(
    t.mutation(api.stores.create, { name: "Guest store" })
  ).rejects.toThrow("Unauthenticated")
  const first = await authenticate(t, "first@example.com")
  const second = await authenticate(t, "second@example.com")
  const firstStore = await first.mutation(api.stores.create, {
    name: "First Cafe",
  })
  expect(await second.query(api.stores.workspace)).toMatchObject({
    store: null,
    role: null,
  })
  const secondStore = await second.mutation(api.stores.create, {
    name: "Second Cafe",
  })
  expect(secondStore).not.toBe(firstStore)
  expect(await first.query(api.stores.workspace)).toMatchObject({
    store: { _id: firstStore, name: "First Cafe" },
  })
  expect(await second.query(api.stores.workspace)).toMatchObject({
    store: { _id: secondStore, name: "Second Cafe" },
  })
  await expect(
    second.query(api.stores.get, { storeId: firstStore })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  await expect(
    t.query(api.stores.get, { storeId: firstStore })
  ).rejects.toThrow("Unauthenticated")
  expect(
    await first.query(api.stores.get, { storeId: firstStore })
  ).toMatchObject({ name: "First Cafe" })
})

test("invalid names do not create a store and simultaneous submissions resolve to one store", async () => {
  const t = backend()
  const owner = await authenticate(t, "retry@example.com")
  await expect(
    owner.mutation(api.stores.create, { name: " " })
  ).rejects.toThrow("INVALID_STORE_NAME")
  expect(await owner.query(api.stores.workspace)).toMatchObject({ store: null })
  const stores = await Promise.all([
    owner.mutation(api.stores.create, { name: "First name" }),
    owner.mutation(api.stores.create, { name: "Second name" }),
  ])
  expect(new Set(stores).size).toBe(1)
})

test("trial access ends at the exact fourteen-day boundary without hiding the store", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  vi.setSystemTime(new Date("2026-10-10T00:00:00Z"))
  const t = backend()
  const email = "trial@example.com"
  const owner = await authenticate(t, email)
  const storeId = await owner.mutation(api.stores.create, {
    name: "Trial Cafe",
  })
  vi.advanceTimersByTime(14 * 24 * 60 * 60 * 1000 - 1)
  const returningOwner = await authenticate(t, email, false)
  expect(await returningOwner.query(api.stores.workspace)).toMatchObject({
    access: { active: true },
  })
  vi.advanceTimersByTime(1)
  expect(await returningOwner.query(api.stores.workspace)).toMatchObject({
    store: { _id: storeId, name: "Trial Cafe" },
    access: { active: false, expiresAt: Date.parse("2026-10-24T00:00:00Z") },
  })
  await t.finishInProgressScheduledFunctions()
  expect(await returningOwner.query(api.stores.workspace)).toMatchObject({
    store: { expiredAt: Date.parse("2026-10-24T00:00:00Z") },
    access: { active: false },
  })
})

test("staff cannot create an owner store and revoked sessions lose private access", async () => {
  const t = backend()
  const owner = await authenticate(t, "membership-owner@example.com")
  const staff = await authenticate(t, "staff@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Membership Cafe",
  })
  const staffUser = await staff.query(api.auth.getAuthUser)
  await t.run(async (ctx) => {
    await ctx.db.insert("memberships", {
      userId: staffUser._id,
      storeId,
      role: "staff",
    })
  })
  await expect(
    staff.mutation(api.stores.create, { name: "Staff store" })
  ).rejects.toThrow("OWNER_REQUIRED")
  expect(await staff.query(api.stores.workspace)).toMatchObject({
    role: "staff",
    store: { _id: storeId },
  })
  await t.mutation(components.betterAuth.adapter.deleteMany, {
    paginationOpts: { cursor: null, numItems: 10 },
    input: {
      model: "session",
      where: [{ field: "userId", value: staffUser._id }],
    },
  })
  await expect(staff.query(api.stores.workspace)).rejects.toThrow(
    "Unauthenticated"
  )
  await expect(staff.query(api.stores.get, { storeId })).rejects.toThrow(
    "Unauthenticated"
  )
})
