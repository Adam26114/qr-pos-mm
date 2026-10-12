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
  // Even an owner-issued fresh legacy invitation cannot undo deactivation.
  await firstOwner.action(api.staff.invite, {
    storeId: firstStore,
    email: "staff@example.com",
  })
  vi.advanceTimersByTime(0)
  await t.finishInProgressScheduledFunctions()
  const returningToken = new URL(
    emails[2]!.text.match(/https?:\/\/\S+/)![0]
  ).pathname
    .split("/")
    .at(-1)!
  await expect(
    staff.mutation(api.staff.accept, { token: returningToken })
  ).rejects.toThrow("STAFF_DEACTIVATED")
  await firstOwner.mutation(api.staff.reactivate, {
    storeId: firstStore,
    membershipId,
  })
  expect(await staff.query(api.stores.workspace)).toMatchObject({
    store: { _id: firstStore },
    role: "staff",
  })
  await expect(
    staff.mutation(api.staff.accept, { token: tokens[1]! })
  ).rejects.toThrow("MEMBERSHIP_CONFLICT")
  await expect(
    staff.query(api.stores.get, { storeId: secondStore })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
})

test("a shareable join link creates an individual membership with contact-only phone and never exposes its stored capability", async () => {
  const t = backend()
  const owner = await authenticate(t, "link-owner@example.com")
  const storeId = await owner.mutation(api.stores.create, { name: "Link Cafe" })
  const trial = (await owner.query(api.stores.get, { storeId })).trialEndsAt
  const link = await owner.action(api.staff.createJoinLink, { storeId })
  expect(link.token).toMatch(/^[a-f0-9]{64}$/)
  expect(link.expiresInDays).toBe(7)
  expect(await t.query(api.staff.preview, { token: link.token })).toEqual({
    kind: "link",
    storeName: "Link Cafe",
    expiresAt: link.expiresAt,
  })
  const stored = await t.run((ctx) => ctx.db.get(link.invitationId))
  expect(stored).toMatchObject({ kind: "link", status: "pending" })
  expect(stored!.tokenHash).not.toBe(link.token)
  expect(stored).not.toHaveProperty("token")
  expect(stored).not.toHaveProperty("email")
  const staff = await authenticate(t, "individual@example.com")
  await staff.mutation(api.staff.accept, {
    token: link.token,
    phone: "  +95 (9) 123-456  ",
  })
  const directory = await owner.query(api.staff.directory, { storeId })
  expect(directory.members).toMatchObject([
    {
      email: "individual@example.com",
      phone: "+95 (9) 123-456",
      status: "active",
    },
  ])
  expect(directory.invitations).toMatchObject([
    {
      kind: "link",
      email: null,
      delivery: null,
      status: "accepted",
      expiresInDays: 7,
    },
  ])
  expect(directory.invitations[0]).not.toHaveProperty("tokenHash")
  expect(directory.invitations[0]).not.toHaveProperty("token")
  expect(await t.query(api.staff.preview, { token: link.token })).toBeNull()
  await expect(
    staff.mutation(api.staff.accept, { token: link.token })
  ).rejects.toThrow("INVALID_INVITATION")
  expect((await owner.query(api.stores.get, { storeId })).trialEndsAt).toBe(
    trial
  )
  expect(await staff.query(api.stores.workspace)).toMatchObject({
    role: "staff",
    store: { _id: storeId },
  })
  await expect(
    staff.mutation(api.stores.create, { name: "Staff trial" })
  ).rejects.toThrow("OWNER_REQUIRED")
})

test.each([1, 3, 7] as const)(
  "a %i-day join link expires at the exact server boundary before scheduled invalidation",
  async (expiresInDays) => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
    vi.setSystemTime(new Date("2026-10-10T00:00:00Z"))
    const t = backend()
    const owner = await authenticate(t, "expiry-link-owner@example.com")
    const storeId = await owner.mutation(api.stores.create, {
      name: "Boundary Cafe",
    })
    const link = await owner.action(api.staff.createJoinLink, {
      storeId,
      expiresInDays,
    })
    const lifetime = expiresInDays * 24 * 60 * 60 * 1000
    expect(link.expiresAt).toBe(Date.now() + lifetime)
    vi.advanceTimersByTime(lifetime - 1)
    expect(
      await t.query(api.staff.preview, { token: link.token })
    ).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(await t.query(api.staff.preview, { token: link.token })).toBeNull()
    const staff = await authenticate(t, "too-late@example.com")
    await expect(
      staff.mutation(api.staff.accept, { token: link.token })
    ).rejects.toThrow("INVALID_INVITATION")
    await t.finishInProgressScheduledFunctions()
    const returningOwner = await authenticate(
      t,
      "expiry-link-owner@example.com",
      false
    )
    expect(
      await returningOwner.query(api.staff.directory, { storeId })
    ).toMatchObject({ invitations: [{ status: "expired" }] })
  }
)

test("a single-use link cannot grant access to two competing accounts", async () => {
  const t = backend()
  const owner = await authenticate(t, "race-owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Single Worker Cafe",
  })
  const link = await owner.action(api.staff.createJoinLink, {
    storeId,
    expiresInDays: 1,
  })
  const first = await authenticate(t, "first-worker@example.com")
  const second = await authenticate(t, "second-worker@example.com")
  const results = await Promise.allSettled([
    first.mutation(api.staff.accept, { token: link.token }),
    second.mutation(api.staff.accept, { token: link.token }),
  ])
  expect(
    results.filter((result) => result.status === "fulfilled")
  ).toHaveLength(1)
  const rejected = results.find(
    (result) => result.status === "rejected"
  ) as PromiseRejectedResult
  expect(String(rejected.reason)).toContain("INVALID_INVITATION")
  expect(
    (await owner.query(api.staff.directory, { storeId })).members
  ).toHaveLength(1)
})

test("regeneration replaces the old capability atomically, preserves or changes its lifetime, and never renews a consumed link", async () => {
  const t = backend()
  const owner = await authenticate(t, "regenerate-owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Fresh Link Cafe",
  })
  const original = await owner.action(api.staff.createJoinLink, {
    storeId,
    expiresInDays: 3,
  })
  const renewed = await owner.action(api.staff.regenerateJoinLink, {
    storeId,
    invitationId: original.invitationId,
  })
  expect(renewed.invitationId).not.toBe(original.invitationId)
  expect(renewed.token).not.toBe(original.token)
  expect(renewed.expiresInDays).toBe(3)
  expect(await t.query(api.staff.preview, { token: original.token })).toBeNull()
  expect(
    await t.query(api.staff.preview, { token: renewed.token })
  ).not.toBeNull()
  expect(await t.run((ctx) => ctx.db.get(original.invitationId))).toMatchObject(
    { status: "revoked" }
  )
  await owner.mutation(api.staff.revokeInvitation, {
    storeId,
    invitationId: renewed.invitationId,
  })
  const short = await owner.action(api.staff.regenerateJoinLink, {
    storeId,
    invitationId: renewed.invitationId,
    expiresInDays: 1,
  })
  expect(short.expiresInDays).toBe(1)
  const staff = await authenticate(t, "renewed-worker@example.com")
  await staff.mutation(api.staff.accept, { token: short.token })
  await expect(
    owner.action(api.staff.regenerateJoinLink, {
      storeId,
      invitationId: short.invitationId,
    })
  ).rejects.toThrow("INVALID_INVITATION")
})

test("acceptance racing replacement cannot consume the old link and create a replacement", async () => {
  const t = backend()
  const owner = await authenticate(t, "replacement-race-owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Replacement Race Cafe",
  })
  const link = await owner.action(api.staff.createJoinLink, { storeId })
  const staff = await authenticate(t, "replacement-race-worker@example.com")
  const results = await Promise.allSettled([
    owner.action(api.staff.regenerateJoinLink, {
      storeId,
      invitationId: link.invitationId,
    }),
    staff.mutation(api.staff.accept, { token: link.token }),
  ])
  expect(
    results.filter((result) => result.status === "fulfilled")
  ).toHaveLength(1)
  const rejected = results.find(
    (result) => result.status === "rejected"
  ) as PromiseRejectedResult
  expect(String(rejected.reason)).toContain("INVALID_INVITATION")
  const directory = await owner.query(api.staff.directory, { storeId })
  const replacementWon = results[0]!.status === "fulfilled"
  expect(directory.members).toHaveLength(replacementWon ? 0 : 1)
  expect(directory.invitations).toHaveLength(replacementWon ? 2 : 1)
})

test("concurrent regenerations of one source create exactly one replacement capability", async () => {
  const t = backend()
  const owner = await authenticate(t, "double-replacement-owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "One Replacement Cafe",
  })
  const source = await owner.action(api.staff.createJoinLink, { storeId })
  const results = await Promise.allSettled([
    owner.action(api.staff.regenerateJoinLink, {
      storeId,
      invitationId: source.invitationId,
    }),
    owner.action(api.staff.regenerateJoinLink, {
      storeId,
      invitationId: source.invitationId,
    }),
  ])
  expect(
    results.filter((result) => result.status === "fulfilled")
  ).toHaveLength(1)
  const rejected = results.find(
    (result) => result.status === "rejected"
  ) as PromiseRejectedResult
  expect(String(rejected.reason)).toContain("INVALID_INVITATION")
  const replacement = results.find((result) => result.status === "fulfilled")
  if (!replacement || replacement.status !== "fulfilled")
    throw new Error("Replacement was not created")
  const directory = await owner.query(api.staff.directory, { storeId })
  expect(directory.invitations).toHaveLength(2)
  expect(
    directory.invitations.filter(
      (invitation) => invitation.status === "pending"
    )
  ).toHaveLength(1)
  expect(
    directory.invitations.find(
      (invitation) => invitation._id === source.invitationId
    )
  ).toMatchObject({
    status: "revoked",
    replacedBy: replacement.value.invitationId,
  })
  expect(await t.query(api.staff.preview, { token: source.token })).toBeNull()
  expect(
    await t.query(api.staff.preview, { token: replacement.value.token })
  ).not.toBeNull()
  await expect(
    owner.action(api.staff.regenerateJoinLink, {
      storeId,
      invitationId: source.invitationId,
    })
  ).rejects.toThrow("INVALID_INVITATION")
})

test("optional contact phone validates without consuming the link on failure", async () => {
  const t = backend()
  const owner = await authenticate(t, "contact-owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Contact Cafe",
  })
  const link = await owner.action(api.staff.createJoinLink, { storeId })
  const staff = await authenticate(t, "contact-worker@example.com")
  for (const phone of ["not-a-phone", "+---", "9".repeat(33)]) {
    await expect(
      staff.mutation(api.staff.accept, { token: link.token, phone })
    ).rejects.toThrow("INVALID_PHONE")
    expect(
      await t.query(api.staff.preview, { token: link.token })
    ).not.toBeNull()
  }
  await staff.mutation(api.staff.accept, { token: link.token, phone: "   " })
  expect(
    (await owner.query(api.staff.directory, { storeId })).members[0]!.phone
  ).toBeNull()
})

test("deactivation blocks generic rejoining and only the store owner can restore the existing membership", async () => {
  const t = backend()
  const owner = await authenticate(t, "deactivation-owner@example.com")
  const otherOwner = await authenticate(t, "deactivation-other@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Restored Cafe",
  })
  const otherStore = await otherOwner.mutation(api.stores.create, {
    name: "Other Cafe",
  })
  const staff = await authenticate(t, "deactivated-worker@example.com")
  const link = await owner.action(api.staff.createJoinLink, { storeId })
  await staff.mutation(api.staff.accept, {
    token: link.token,
    phone: "091234567",
  })
  const membershipId = (await owner.query(api.staff.directory, { storeId }))
    .members[0]!._id
  await owner.mutation(api.staff.remove, { storeId, membershipId })
  await owner.mutation(api.staff.remove, { storeId, membershipId })
  expect(await staff.query(api.stores.workspace)).toMatchObject({
    accountKind: "staff",
    role: null,
    store: null,
  })
  await expect(staff.query(api.orders.queue, { storeId })).rejects.toThrow(
    "STORE_ACCESS_DENIED"
  )
  const bypass = await owner.action(api.staff.createJoinLink, { storeId })
  await expect(
    staff.mutation(api.staff.accept, { token: bypass.token })
  ).rejects.toThrow("STAFF_DEACTIVATED")
  expect(
    await t.query(api.staff.preview, { token: bypass.token })
  ).not.toBeNull()
  await expect(
    staff.mutation(api.staff.reactivate, { storeId, membershipId })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  await expect(
    otherOwner.mutation(api.staff.reactivate, {
      storeId: otherStore,
      membershipId,
    })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  await owner.mutation(api.staff.reactivate, { storeId, membershipId })
  await owner.mutation(api.staff.reactivate, { storeId, membershipId })
  expect((await owner.query(api.staff.directory, { storeId })).members).toEqual(
    [
      expect.objectContaining({
        _id: membershipId,
        phone: "091234567",
        status: "active",
      }),
    ]
  )
  expect(await staff.query(api.orders.queue, { storeId })).toEqual([])
  await expect(
    staff.mutation(api.staff.reactivate, { storeId, membershipId })
  ).rejects.toThrow("OWNER_REQUIRED")
  const ownerMembership = await t.run((ctx) =>
    ctx.db
      .query("memberships")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .filter((q) => q.eq(q.field("role"), "owner"))
      .unique()
  )
  await expect(
    owner.mutation(api.staff.reactivate, {
      storeId,
      membershipId: ownerMembership!._id,
    })
  ).rejects.toThrow("STAFF_REQUIRED")
})

test("a legacy invitation outstanding before deactivation cannot bypass the owner's decision", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  vi.stubEnv("DEV_EMAIL_CAPTURE_URL", "http://127.0.0.1:4010/emails")
  let emailText = ""
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    emailText = JSON.parse(options.body as string).text
    return new Response("{}", { status: 200 })
  })
  const t = backend()
  const owner = await authenticate(t, "legacy-pending-owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Deactivation Guard Cafe",
  })
  await owner.action(api.staff.invite, {
    storeId,
    email: "legacy-pending-worker@example.com",
  })
  vi.advanceTimersByTime(0)
  await t.finishInProgressScheduledFunctions()
  const legacyToken = new URL(emailText.match(/https?:\/\/\S+/)![0]).pathname
    .split("/")
    .at(-1)!
  const link = await owner.action(api.staff.createJoinLink, { storeId })
  const staff = await authenticate(t, "legacy-pending-worker@example.com")
  await staff.mutation(api.staff.accept, { token: link.token })
  const membershipId = (await owner.query(api.staff.directory, { storeId }))
    .members[0]!._id
  await owner.mutation(api.staff.remove, { storeId, membershipId })
  await expect(
    staff.mutation(api.staff.accept, { token: legacyToken })
  ).rejects.toThrow("STAFF_DEACTIVATED")
  expect(
    await t.query(api.staff.preview, { token: legacyToken })
  ).not.toBeNull()
  await owner.mutation(api.staff.reactivate, { storeId, membershipId })
  expect(
    (await owner.query(api.staff.directory, { storeId })).members
  ).toHaveLength(1)
  expect(await staff.query(api.stores.workspace)).toMatchObject({
    role: "staff",
    store: { _id: storeId },
  })
})

test("reactivation rejects an active membership in another store and restores access after that conflict is removed", async () => {
  const t = backend()
  const firstOwner = await authenticate(t, "restore-first@example.com")
  const secondOwner = await authenticate(t, "restore-second@example.com")
  const firstStore = await firstOwner.mutation(api.stores.create, {
    name: "First Restore Cafe",
  })
  const secondStore = await secondOwner.mutation(api.stores.create, {
    name: "Second Restore Cafe",
  })
  const staff = await authenticate(t, "transfer-worker@example.com")
  const firstLink = await firstOwner.action(api.staff.createJoinLink, {
    storeId: firstStore,
  })
  await staff.mutation(api.staff.accept, { token: firstLink.token })
  const firstMembership = (
    await firstOwner.query(api.staff.directory, { storeId: firstStore })
  ).members[0]!._id
  await firstOwner.mutation(api.staff.remove, {
    storeId: firstStore,
    membershipId: firstMembership,
  })
  const secondLink = await secondOwner.action(api.staff.createJoinLink, {
    storeId: secondStore,
  })
  await staff.mutation(api.staff.accept, { token: secondLink.token })
  await expect(
    firstOwner.mutation(api.staff.reactivate, {
      storeId: firstStore,
      membershipId: firstMembership,
    })
  ).rejects.toThrow("MEMBERSHIP_CONFLICT")
  const secondMembership = (
    await secondOwner.query(api.staff.directory, { storeId: secondStore })
  ).members[0]!._id
  await secondOwner.mutation(api.staff.remove, {
    storeId: secondStore,
    membershipId: secondMembership,
  })
  await firstOwner.mutation(api.staff.reactivate, {
    storeId: firstStore,
    membershipId: firstMembership,
  })
  expect(await staff.query(api.stores.workspace)).toMatchObject({
    role: "staff",
    store: { _id: firstStore },
  })
})

test("join link management rejects guests, staff, foreign store access and unsupported lifetimes", async () => {
  const t = backend()
  const owner = await authenticate(t, "guards-owner@example.com")
  const foreign = await authenticate(t, "guards-foreign@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Guarded Cafe",
  })
  const otherStore = await foreign.mutation(api.stores.create, {
    name: "Foreign Guard Cafe",
  })
  await expect(t.action(api.staff.createJoinLink, { storeId })).rejects.toThrow(
    "Unauthenticated"
  )
  await expect(
    foreign.action(api.staff.createJoinLink, { storeId })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  await expect(
    owner.action(api.staff.createJoinLink, { storeId, expiresInDays: 2 as 1 })
  ).rejects.toThrow()
  const link = await owner.action(api.staff.createJoinLink, { storeId })
  await expect(
    t.action(api.staff.regenerateJoinLink, {
      storeId,
      invitationId: link.invitationId,
    })
  ).rejects.toThrow("Unauthenticated")
  await expect(
    foreign.action(api.staff.regenerateJoinLink, {
      storeId: otherStore,
      invitationId: link.invitationId,
    })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  const staff = await authenticate(t, "guards-worker@example.com")
  await staff.mutation(api.staff.accept, { token: link.token })
  await expect(
    staff.action(api.staff.createJoinLink, { storeId })
  ).rejects.toThrow("OWNER_REQUIRED")
  await expect(
    staff.action(api.staff.regenerateJoinLink, {
      storeId,
      invitationId: link.invitationId,
    })
  ).rejects.toThrow("OWNER_REQUIRED")
})

test("legacy records without link metadata keep their invited-email restriction and cancellation behavior", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] })
  vi.stubEnv("DEV_EMAIL_CAPTURE_URL", "http://127.0.0.1:4010/emails")
  let emailText = ""
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    emailText = JSON.parse(options.body as string).text
    return new Response("{}", { status: 200 })
  })
  const t = backend()
  const owner = await authenticate(t, "legacy-owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Legacy Cafe",
  })
  const invitationId = await owner.action(api.staff.invite, {
    storeId,
    email: "legacy-worker@example.com",
  })
  vi.advanceTimersByTime(0)
  await t.finishInProgressScheduledFunctions()
  const token = new URL(emailText.match(/https?:\/\/\S+/)![0]).pathname
    .split("/")
    .at(-1)!
  await t.run((ctx) =>
    ctx.db.patch(invitationId, { kind: undefined, expiresInDays: undefined })
  )
  expect(await t.query(api.staff.preview, { token })).toMatchObject({
    kind: "email",
    email: "legacy-worker@example.com",
  })
  expect(
    (await owner.query(api.staff.directory, { storeId })).invitations
  ).toMatchObject([{ kind: "email", expiresInDays: 7 }])
  await expect(
    owner.action(api.staff.regenerateJoinLink, { storeId, invitationId })
  ).rejects.toThrow("INVALID_INVITATION")
  const wrong = await authenticate(t, "legacy-wrong@example.com")
  await expect(wrong.mutation(api.staff.accept, { token })).rejects.toThrow(
    "INVITATION_EMAIL_MISMATCH"
  )
  const invited = await authenticate(t, "legacy-worker@example.com")
  await invited.mutation(api.staff.accept, { token })
  expect(
    (await owner.query(api.staff.directory, { storeId })).members[0]!.phone
  ).toBeNull()
})
