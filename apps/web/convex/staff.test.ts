import { afterEach, expect, test, vi } from "vitest"
import { api } from "./_generated/api"
import { backend, authenticate } from "../test/convex"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

test("an emailed invitation joins an individual staff account to the owner's store without another trial", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  vi.setSystemTime(new Date("2026-10-10T00:00:00Z"))
  vi.stubEnv("DEV_EMAIL_CAPTURE_URL", "http://127.0.0.1:4010/emails")
  const emails: { to: string[]; text: string }[] = []
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    emails.push(JSON.parse(options.body as string))
    return new Response(JSON.stringify({ id: "captured" }), { status: 200 })
  })
  const t = backend()
  const owner = await authenticate(t, "owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Mingalar Cafe",
  })
  const initialTrial = (await owner.query(api.stores.get, { storeId }))
    .trialEndsAt
  await owner.action(api.staff.invite, { storeId, email: "STAFF@example.com" })
  vi.advanceTimersByTime(0)
  await t.finishInProgressScheduledFunctions()
  expect(emails).toHaveLength(1)
  expect(emails[0]!.to).toEqual(["staff@example.com"])
  const url = new URL(emails[0]!.text.match(/https?:\/\/\S+/)![0])
  const token = url.pathname.split("/").at(-1)!
  expect(await t.query(api.staff.preview, { token })).toMatchObject({
    email: "staff@example.com",
    storeName: "Mingalar Cafe",
    expiresAt: Date.parse("2026-10-17T00:00:00Z"),
  })
  const staff = await authenticate(t, "staff@example.com")
  expect(await staff.mutation(api.staff.accept, { token })).toBe(storeId)
  expect(await staff.query(api.stores.workspace)).toMatchObject({
    role: "staff",
    store: { _id: storeId, name: "Mingalar Cafe" },
    access: null,
  })
  expect((await owner.query(api.stores.get, { storeId })).trialEndsAt).toBe(
    initialTrial
  )
  await expect(
    staff.mutation(api.stores.create, { name: "New trial" })
  ).rejects.toThrow("OWNER_REQUIRED")
  expect(await owner.query(api.staff.directory, { storeId })).toMatchObject({
    members: [{ email: "staff@example.com", status: "active" }],
    invitations: [{ email: "staff@example.com", status: "accepted" }],
  })
})

test("concurrent invitation retries send one link and expired links cannot grant access", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  vi.setSystemTime(new Date("2026-10-10T00:00:00Z"))
  vi.stubEnv("DEV_EMAIL_CAPTURE_URL", "http://127.0.0.1:4010/emails")
  const emails: { text: string }[] = []
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    emails.push(JSON.parse(options.body as string))
    return new Response("{}", { status: 200 })
  })
  const t = backend()
  const owner = await authenticate(t, "owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Expiry Cafe",
  })
  const ids = await Promise.all([
    owner.action(api.staff.invite, { storeId, email: "staff@example.com" }),
    owner.action(api.staff.invite, { storeId, email: "staff@example.com" }),
  ])
  expect(ids[0]).toBe(ids[1])
  vi.advanceTimersByTime(0)
  await t.finishInProgressScheduledFunctions()
  expect(emails).toHaveLength(1)
  const token = new URL(emails[0]!.text.match(/https?:\/\/\S+/)![0]).pathname
    .split("/")
    .at(-1)!
  vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 - 1)
  expect(await t.query(api.staff.preview, { token })).not.toBeNull()
  const staff = await authenticate(t, "staff@example.com")
  const returningOwner = await authenticate(t, "owner@example.com", false)
  vi.advanceTimersByTime(1)
  expect(await t.query(api.staff.preview, { token })).toBeNull()
  await expect(staff.mutation(api.staff.accept, { token })).rejects.toThrow(
    "INVALID_INVITATION"
  )
  await t.finishInProgressScheduledFunctions()
  expect(
    await returningOwner.query(api.staff.directory, { storeId })
  ).toMatchObject({ invitations: [{ status: "expired" }] })
  const renewedId = await returningOwner.action(api.staff.invite, {
    storeId,
    email: "staff@example.com",
  })
  expect(renewedId).not.toBe(ids[0])
  vi.advanceTimersByTime(0)
  await t.finishInProgressScheduledFunctions()
  const renewedToken = new URL(
    emails[1]!.text.match(/https?:\/\/\S+/)![0]
  ).pathname
    .split("/")
    .at(-1)!
  const wrongAccount = await authenticate(t, "wrong@example.com")
  await expect(
    wrongAccount.mutation(api.staff.accept, { token: renewedToken })
  ).rejects.toThrow("INVITATION_EMAIL_MISMATCH")
  expect(await staff.mutation(api.staff.accept, { token: renewedToken })).toBe(
    storeId
  )
  await expect(
    staff.mutation(api.staff.accept, { token: renewedToken })
  ).rejects.toThrow("INVALID_INVITATION")
})

test("only the owner manages staff and removal revokes an open account without enabling owner onboarding", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  vi.stubEnv("DEV_EMAIL_CAPTURE_URL", "http://127.0.0.1:4010/emails")
  let text = ""
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    text = JSON.parse(options.body as string).text
    return new Response("{}", { status: 200 })
  })
  const t = backend()
  const owner = await authenticate(t, "owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Membership Cafe",
  })
  await owner.action(api.staff.invite, { storeId, email: "staff@example.com" })
  vi.advanceTimersByTime(0)
  await t.finishInProgressScheduledFunctions()
  const token = new URL(text.match(/https?:\/\/\S+/)![0]).pathname
    .split("/")
    .at(-1)!
  const staff = await authenticate(t, "staff@example.com")
  await staff.mutation(api.staff.accept, { token })
  await expect(
    staff.action(api.staff.invite, { storeId, email: "other@example.com" })
  ).rejects.toThrow("OWNER_REQUIRED")
  await expect(staff.query(api.staff.directory, { storeId })).rejects.toThrow(
    "OWNER_REQUIRED"
  )
  await expect(staff.query(api.stores.get, { storeId })).rejects.toThrow(
    "OWNER_REQUIRED"
  )
  const membershipId = (await owner.query(api.staff.directory, { storeId }))
    .members[0]!._id
  await expect(
    staff.mutation(api.staff.remove, { storeId, membershipId })
  ).rejects.toThrow("OWNER_REQUIRED")
  await owner.mutation(api.staff.remove, { storeId, membershipId })
  expect(await staff.query(api.stores.workspace)).toMatchObject({
    role: null,
    accountKind: "staff",
    store: null,
  })
  await expect(staff.query(api.stores.get, { storeId })).rejects.toThrow(
    "STORE_ACCESS_DENIED"
  )
  await expect(
    staff.mutation(api.stores.create, { name: "Staff trial" })
  ).rejects.toThrow("OWNER_REQUIRED")
  await expect(staff.mutation(api.staff.accept, { token })).rejects.toThrow(
    "INVALID_INVITATION"
  )
  await owner.mutation(api.staff.remove, { storeId, membershipId })
  expect(await owner.query(api.staff.directory, { storeId })).toMatchObject({
    members: [{ status: "removed" }],
  })
})

test("failed deliveries are visible and canceling an invitation invalidates its link", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  vi.stubEnv("DEV_EMAIL_CAPTURE_URL", "http://127.0.0.1:4010/emails")
  let emailText = ""
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    emailText = JSON.parse(options.body as string).text
    return new Response("{}", { status: 503 })
  })
  const t = backend()
  const owner = await authenticate(t, "owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Delivery Cafe",
  })
  const invitationId = await owner.action(api.staff.invite, {
    storeId,
    email: "staff@example.com",
  })
  vi.advanceTimersByTime(0)
  await t.finishInProgressScheduledFunctions()
  expect(await owner.query(api.staff.directory, { storeId })).toMatchObject({
    invitations: [{ delivery: "failed" }],
  })
  const token = new URL(emailText.match(/https?:\/\/\S+/)![0]).pathname
    .split("/")
    .at(-1)!
  await owner.mutation(api.staff.revokeInvitation, { storeId, invitationId })
  expect(await t.query(api.staff.preview, { token })).toBeNull()
  const staff = await authenticate(t, "staff@example.com")
  await expect(staff.mutation(api.staff.accept, { token })).rejects.toThrow(
    "INVALID_INVITATION"
  )
  expect(
    await owner.action(api.staff.invite, {
      storeId,
      email: "staff@example.com",
    })
  ).not.toBe(invitationId)
})

test("store-bound invitations reject guests, conflicting memberships and duplicate active staff", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  vi.stubEnv("DEV_EMAIL_CAPTURE_URL", "http://127.0.0.1:4010/emails")
  const emails: { to: string[]; text: string }[] = []
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    emails.push(JSON.parse(options.body as string))
    return new Response("{}", { status: 200 })
  })
  const t = backend()
  const firstOwner = await authenticate(t, "first@example.com")
  const secondOwner = await authenticate(t, "second@example.com")
  const firstStore = await firstOwner.mutation(api.stores.create, {
    name: "First Cafe",
  })
  const secondStore = await secondOwner.mutation(api.stores.create, {
    name: "Second Cafe",
  })
  await expect(
    firstOwner.action(api.staff.invite, {
      storeId: firstStore,
      email: "first@example.com",
    })
  ).rejects.toThrow("MEMBER_EXISTS")
  await expect(
    firstOwner.action(api.staff.invite, {
      storeId: firstStore,
      email: "not-an-email",
    })
  ).rejects.toThrow("INVALID_EMAIL")
  await expect(
    secondOwner.action(api.staff.invite, {
      storeId: firstStore,
      email: "staff@example.com",
    })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  const firstInvite = await firstOwner.action(api.staff.invite, {
    storeId: firstStore,
    email: "staff@example.com",
  })
  await secondOwner.action(api.staff.invite, {
    storeId: secondStore,
    email: "staff@example.com",
  })
  vi.advanceTimersByTime(0)
  await t.finishInProgressScheduledFunctions()
  const tokens = emails.map((email) =>
    new URL(email.text.match(/https?:\/\/\S+/)![0]).pathname.split("/").at(-1)!
  )
  await expect(
    t.mutation(api.staff.accept, { token: tokens[0]! })
  ).rejects.toThrow("Unauthenticated")
  await expect(
    t.query(api.staff.directory, { storeId: firstStore })
  ).rejects.toThrow("Unauthenticated")
  await expect(
    secondOwner.mutation(api.staff.revokeInvitation, {
      storeId: secondStore,
      invitationId: firstInvite,
    })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  const staff = await authenticate(t, "staff@example.com")
  await staff.mutation(api.staff.accept, { token: tokens[0]! })
  await expect(
    staff.mutation(api.staff.accept, { token: tokens[1]! })
  ).rejects.toThrow("MEMBERSHIP_CONFLICT")
  await expect(
    firstOwner.action(api.staff.invite, {
      storeId: firstStore,
      email: "staff@example.com",
    })
  ).rejects.toThrow("MEMBER_EXISTS")
  const membershipId = (
    await firstOwner.query(api.staff.directory, { storeId: firstStore })
  ).members[0]!._id
  await expect(
    secondOwner.mutation(api.staff.remove, {
      storeId: secondStore,
      membershipId,
    })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  await firstOwner.mutation(api.staff.remove, {
    storeId: firstStore,
    membershipId,
  })
  // A fresh invitation can restore access; only one active store context is retained.
  await staff.mutation(api.staff.accept, { token: tokens[1]! })
  expect(await staff.query(api.stores.workspace)).toMatchObject({
    store: { _id: secondStore },
    role: "staff",
  })
  await expect(
    staff.query(api.stores.get, { storeId: firstStore })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
})
