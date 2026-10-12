import { afterEach, expect, test, vi } from "vitest"
import { api, internal } from "./_generated/api"
import { backend, authenticate } from "../test/convex"

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function cafe() {
  const t = backend()
  const owner = await authenticate(t, `${crypto.randomUUID()}@example.com`)
  const storeId = await owner.mutation(api.stores.create, {
    name: "Reports Cafe",
  })
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "Drinks",
  })
  const itemId = await owner.mutation(api.menu.saveItem, {
    storeId,
    categoryId,
    name: "Tea",
    description: "",
    price: 2500,
    available: true,
    photoId: null,
  })
  const create = () =>
    owner.mutation(api.orders.createCounter, {
      storeId,
      submissionKey: crypto.randomUUID(),
      lines: [{ itemId, quantity: 1, expectedPrice: 2500 }],
      note: "",
    })
  return { t, owner, storeId, itemId, create }
}

test("owner reports reconcile live collections and current unpaid bills without counting retries", async () => {
  const { owner, storeId, create } = await cafe()
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-12T00:00:00Z"))
  const args = { storeId, kind: "day" as const, key: "2026-10-12" }
  expect(await owner.query(api.reports.summary, args)).toMatchObject({
    ready: true,
    collected: 0,
    refunded: 0,
    net: 0,
    unpaidAmount: 0,
    unpaidCount: 0,
  })
  const orderId = await create()
  expect(await owner.query(api.reports.summary, args)).toMatchObject({
    unpaidAmount: 2500,
    unpaidCount: 1,
  })
  await Promise.all([
    owner.mutation(api.orders.recordCash, { storeId, orderId }),
    owner.mutation(api.orders.recordCash, { storeId, orderId }),
  ])
  expect(await owner.query(api.reports.summary, args)).toMatchObject({
    collected: 2500,
    refunded: 0,
    net: 2500,
    unpaidAmount: 0,
    unpaidCount: 0,
  })
})

test("Yangon reports use collection and refund completion periods, including negative net and half-open midnight boundaries", async () => {
  const { owner, storeId, create } = await cafe()
  const first = await create()
  const second = await create()
  const clock = vi
    .spyOn(Date, "now")
    .mockReturnValue(Date.parse("2026-10-31T17:29:59Z"))
  await owner.mutation(api.orders.recordCash, { storeId, orderId: first })
  const period = { storeId, kind: "day" as const, key: "2026-10-31" }
  const before = await owner.query(api.reports.summary, period)
  expect(before).toMatchObject({
    collected: 2500,
    refunded: 0,
    net: 2500,
    unpaidAmount: 2500,
    unpaidCount: 1,
  })
  expect(before.period).toMatchObject({
    start: Date.parse("2026-10-30T17:30:00Z"),
    end: Date.parse("2026-10-31T17:30:00Z"),
  })
  clock.mockReturnValue(Date.parse("2026-10-31T17:30:00Z"))
  await owner.mutation(api.orders.cancel, {
    storeId,
    orderId: first,
    requestKey: "period-cancel",
    reason: "Returned",
  })
  const detail = await owner.query(api.orders.detail, {
    storeId,
    orderId: first,
  })
  const refund = {
    storeId,
    orderId: first,
    collectionId: detail.collections[0]!._id,
    requestKey: "period-refund",
    reason: "Cash returned",
  }
  await owner.mutation(api.orders.recordRefund, refund)
  await owner.mutation(api.orders.recordRefund, refund)
  expect(
    await owner.query(api.reports.summary, { ...period, key: "2026-11-01" })
  ).toMatchObject({
    collected: 0,
    refunded: 2500,
    net: -2500,
    unpaidAmount: 2500,
  })
  expect(
    await owner.query(api.reports.summary, {
      ...period,
      kind: "month",
      key: "2026-10",
    })
  ).toMatchObject({ collected: 2500, refunded: 0, net: 2500 })
  const refunded = await owner.query(api.reports.refunds, {
    ...period,
    key: "2026-11-01",
    paginationOpts: { cursor: null, numItems: 10 },
  })
  expect(refunded.page).toHaveLength(1)
  expect(refunded.page[0]).toMatchObject({
    amount: 2500,
    eventAt: Date.parse("2026-10-31T17:30:00Z"),
    order: { _id: first, status: "cancelled" },
  })
  await owner.mutation(api.orders.recordCash, { storeId, orderId: second })
  const collected = await owner.query(api.reports.collections, {
    ...period,
    key: "2026-11-01",
    paginationOpts: { cursor: null, numItems: 10 },
  })
  expect(collected.page.map((row) => row.order._id)).toEqual([second])
  expect(
    await owner.query(api.reports.summary, {
      ...period,
      kind: "month",
      key: "2026-11",
    })
  ).toMatchObject({ collected: 2500, refunded: 2500, net: 0, unpaidAmount: 0 })
})

test("reports deny staff, guests and foreign owners while retaining owner access after expiry and validating calendars", async () => {
  const { t, owner, storeId } = await cafe()
  const staff = await authenticate(
    t,
    `staff-${crypto.randomUUID()}@example.com`
  )
  const invitation = await owner.action(api.staff.createJoinLink, { storeId })
  await staff.mutation(api.staff.accept, { token: invitation.token })
  const outsider = await authenticate(
    t,
    `other-${crypto.randomUUID()}@example.com`
  )
  await outsider.mutation(api.stores.create, { name: "Other Cafe" })
  const args = { storeId, kind: "month" as const, key: "2026-10" }
  for (const actor of [staff, outsider, t]) {
    await expect(actor.query(api.reports.summary, args)).rejects.toThrow()
    for (const query of [api.reports.collections, api.reports.refunds])
      await expect(
        actor.query(query, {
          ...args,
          paginationOpts: { cursor: null, numItems: 10 },
        })
      ).rejects.toThrow()
    await expect(
      actor.query(api.reports.unpaid, {
        storeId,
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).rejects.toThrow()
    await expect(
      actor.query(api.reports.dates, { storeId, refresh: "initial" })
    ).rejects.toThrow()
  }
  await t.run((ctx) => ctx.db.patch(storeId, { trialEndsAt: Date.now() - 1 }))
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-12T17:29:59Z"))
  expect(
    await owner.query(api.reports.dates, { storeId, refresh: "initial" })
  ).toMatchObject({
    day: "2026-10-12",
    month: "2026-10",
    nextMidnight: Date.parse("2026-10-12T17:30:00Z"),
  })
  expect(await owner.query(api.reports.summary, args)).toMatchObject({
    ready: true,
    collected: 0,
  })
  expect(
    (
      await owner.query(api.reports.summary, {
        ...args,
        kind: "day",
        key: "2024-02-29",
      })
    ).period
  ).toMatchObject({
    start: Date.parse("2024-02-28T17:30:00Z"),
    end: Date.parse("2024-02-29T17:30:00Z"),
  })
  for (const key of [
    "2026-02-29",
    "2026-04-31",
    "2026-10-13",
    "2026-1-01",
    "invalid",
  ])
    await expect(
      owner.query(api.reports.summary, { ...args, kind: "day", key })
    ).rejects.toThrow("INVALID_REPORT_PERIOD")
  for (const key of ["2026-13", "2026-11", "2026-00"])
    await expect(
      owner.query(api.reports.summary, { ...args, key })
    ).rejects.toThrow("INVALID_REPORT_PERIOD")
})

test("restartable reporting backfill counts legacy and provider collections once while live operations continue", async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-12T12:00:00Z"))
  const { t, owner: originalOwner, storeId, create } = await cafe()
  let owner = originalOwner
  const email = (await owner.query(api.stores.workspace, {})).user.email
  const first = await create()
  const second = await create()
  const at = Date.now()
  const extra = await t.run(async (ctx) => {
    const state = await ctx.db
      .query("reportStates")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .unique()
    await ctx.db.delete(state!._id)
    for (const id of [first, second])
      await ctx.db.patch(id, {
        reportingDue: undefined,
        outstanding: undefined,
      })
    await ctx.db.insert("cashPayments", {
      storeId,
      orderId: first,
      amount: 2500,
      receivedAt: at - 60000,
      recordedBy: "legacy-cashier",
    })
    const collection = {
      storeId,
      orderId: second,
      amount: 2500,
      currency: "MMK" as const,
      method: "mmqr" as const,
      collectedAt: at,
      timeSource: "verification_fallback" as const,
      recordedAt: at,
      recordedBy: "provider",
    }
    await ctx.db.insert("orderCollections", {
      ...collection,
      reference: "required-provider-money",
    })
    return ctx.db.insert("orderCollections", {
      ...collection,
      reference: "excess-provider-money",
    })
  })
  const args = { storeId, kind: "day" as const, key: "2026-10-12" }
  expect(await owner.query(api.reports.summary, args)).toMatchObject({
    ready: false,
  })
  expect(
    (
      await owner.query(api.reports.collections, {
        ...args,
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).page
  ).toEqual([])
  await t.mutation(internal.reports.backfill, { storeId })
  const cancelled = await create()
  await owner.mutation(api.orders.cancel, {
    storeId,
    orderId: cancelled,
    requestKey: "during-backfill-cancel",
    reason: "Stopped",
  })
  const outstanding = await create()
  await owner.mutation(api.orders.recordRefund, {
    storeId,
    orderId: second,
    collectionId: extra,
    requestKey: "during-backfill-refund",
    reason: "Excess returned",
    completedAt: at - 1000,
  })
  expect(await owner.query(api.reports.summary, args)).toMatchObject({
    ready: false,
  })
  await t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer())
  owner = await authenticate(t, email, false)
  expect(await owner.query(api.reports.summary, args)).toMatchObject({
    ready: true,
    collected: 7500,
    refunded: 2500,
    net: 5000,
    unpaidAmount: 2500,
    unpaidCount: 1,
  })
  for (let retry = 0; retry < 2; retry++) {
    await t.mutation(internal.reports.backfill, { storeId })
    await t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer())
  }
  expect(await owner.query(api.reports.summary, args)).toMatchObject({
    collected: 7500,
    refunded: 2500,
    unpaidAmount: 2500,
  })
  const rows = await owner.query(api.reports.collections, {
    ...args,
    paginationOpts: { cursor: null, numItems: 10 },
  })
  expect(rows.page).toHaveLength(3)
  expect(rows.page.filter((row) => row.method === "cash")).toMatchObject([
    { amount: 2500, recordedAt: at - 60000, eventAt: at - 60000 },
  ])
  const unpaid = await owner.query(api.reports.unpaid, {
    storeId,
    paginationOpts: { cursor: null, numItems: 10 },
  })
  expect(unpaid.page.map((row) => row._id)).toEqual([outstanding])
  await owner.mutation(api.orders.recordCash, { storeId, orderId: outstanding })
  expect(await owner.query(api.reports.summary, args)).toMatchObject({
    unpaidAmount: 0,
    unpaidCount: 0,
  })
})

test("current unpaid lists retain served QR bills, ignore cancelled bills and paginate oldest first independently of report dates", async () => {
  const { t, owner, storeId, itemId, create } = await cafe()
  const tableId = await owner.mutation(api.tables.add, { storeId, number: 1 })
  const clock = vi
    .spyOn(Date, "now")
    .mockReturnValue(Date.parse("2026-10-12T00:00:00Z"))
  const oldest = await t.mutation(api.guestOrders.submit, {
    storeId,
    tableId,
    token: "a".repeat(64),
    lines: [{ itemId, quantity: 1, expectedPrice: 2500 }],
    note: "Served unpaid",
  })
  await owner.mutation(api.orders.startCooking, { storeId, orderId: oldest })
  await owner.mutation(api.orders.markServed, { storeId, orderId: oldest })
  clock.mockReturnValue(Date.parse("2026-10-12T00:00:01Z"))
  const newer = await create()
  clock.mockReturnValue(Date.parse("2026-10-12T00:00:02Z"))
  const cancelled = await create()
  await owner.mutation(api.orders.cancel, {
    storeId,
    orderId: cancelled,
    requestKey: "cancel-unpaid-bill",
    reason: "Customer left",
  })
  expect(
    await owner.query(api.reports.summary, {
      storeId,
      kind: "day",
      key: "2026-10-01",
    })
  ).toMatchObject({
    collected: 0,
    refunded: 0,
    unpaidAmount: 5000,
    unpaidCount: 2,
  })
  const first = await owner.query(api.reports.unpaid, {
    storeId,
    paginationOpts: { cursor: null, numItems: 1 },
  })
  expect(first.page).toMatchObject([
    { _id: oldest, status: "served", due: 2500 },
  ])
  const second = await owner.query(api.reports.unpaid, {
    storeId,
    paginationOpts: { cursor: first.continueCursor, numItems: 1 },
  })
  expect(second.page.map((row) => row._id)).toEqual([newer])
  await owner.mutation(api.orders.recordCash, { storeId, orderId: oldest })
  expect(
    await owner.query(api.reports.summary, {
      storeId,
      kind: "day",
      key: "2026-10-12",
    })
  ).toMatchObject({ collected: 2500, unpaidAmount: 2500, unpaidCount: 1 })
  expect(
    (
      await owner.query(api.reports.unpaid, {
        storeId,
        paginationOpts: { cursor: null, numItems: 10 },
      })
    ).page.map((row) => row._id)
  ).toEqual([newer])
})

test("late verification retains actual collection periods and uncertain refund chronology", async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-12T12:00:00Z"))
  const { t, owner: firstOwner, storeId, create } = await cafe()
  const email = (await firstOwner.query(api.stores.workspace, {})).user.email
  const orderId = await create()
  const collectedAt = Date.parse("2026-10-12T17:29:59Z")
  const verifiedAt = Date.parse("2026-10-12T17:30:00Z")
  vi.setSystemTime(new Date(verifiedAt))
  const extra = await t.run(async (ctx) => {
    const common = {
      storeId,
      orderId,
      amount: 2500,
      currency: "MMK" as const,
      method: "mmqr" as const,
      recordedAt: verifiedAt,
      recordedBy: "provider",
    }
    await ctx.db.insert("orderCollections", {
      ...common,
      collectedAt,
      timeSource: "provider_completed",
      reference: "known-completion",
    })
    return ctx.db.insert("orderCollections", {
      ...common,
      collectedAt: verifiedAt,
      timeSource: "verification_fallback",
      reference: "late-verification",
    })
  })
  await firstOwner.mutation(api.orders.recordRefund, {
    storeId,
    orderId,
    collectionId: extra,
    requestKey: "uncertain-report-refund",
    reason: "Extra returned before verification",
    completedAt: collectedAt,
  })
  await t.mutation(internal.reports.backfill, { storeId })
  await t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer())
  const owner = await authenticate(t, email, false)
  expect(
    await owner.query(api.reports.summary, {
      storeId,
      kind: "day",
      key: "2026-10-12",
    })
  ).toMatchObject({ collected: 2500, refunded: 2500, net: 0 })
  expect(
    await owner.query(api.reports.summary, {
      storeId,
      kind: "day",
      key: "2026-10-13",
    })
  ).toMatchObject({ collected: 2500, refunded: 0, net: 2500 })
  const records = await owner.query(api.reports.collections, {
    storeId,
    kind: "day",
    key: "2026-10-12",
    paginationOpts: { cursor: null, numItems: 10 },
  })
  expect(records.page).toMatchObject([
    {
      eventAt: collectedAt,
      recordedAt: verifiedAt,
      reference: "known-completion",
    },
  ])
  const detail = await owner.query(api.orders.detail, { storeId, orderId })
  expect(detail.refunds[0]).toMatchObject({
    uncertainChronology: true,
    collectionTimeSource: "verification_fallback",
  })
})

test("large legacy backfill stays pending between batches and paginates the complete reconciled ledger", async () => {
  vi.useFakeTimers()
  const { t, owner: firstOwner, storeId, create } = await cafe()
  const email = (await firstOwner.query(api.stores.workspace, {})).user.email
  const first = await create()
  const seed = (
    await firstOwner.query(api.orders.detail, { storeId, orderId: first })
  ).order
  const ids = await t.run(async (ctx) => {
    const state = await ctx.db
      .query("reportStates")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .unique()
    await ctx.db.delete(state!._id)
    await ctx.db.patch(first, {
      reportingDue: undefined,
      outstanding: undefined,
    })
    const { _id, _creationTime, ...fields } = seed
    const ids = [_id]
    for (let i = 1; i < 105; i++)
      ids.push(
        await ctx.db.insert("orders", {
          ...fields,
          submissionKey: `legacy-${i}`,
          createdAt: seed.createdAt + i,
          reportingDue: undefined,
          outstanding: undefined,
        })
      )
    for (const orderId of ids.slice(0, 101))
      await ctx.db.insert("cashPayments", {
        storeId,
        orderId,
        amount: 2500,
        receivedAt: Date.now(),
        recordedBy: "original-cashier",
      })
    return ids
  })
  const dates = await firstOwner.query(api.reports.dates, {
    storeId,
    refresh: "initial",
  })
  const args = { storeId, kind: "day" as const, key: dates.day }
  const step = await t.mutation(internal.reports.backfill, { storeId })
  expect(step.isDone).toBe(false)
  expect(await firstOwner.query(api.reports.summary, args)).toMatchObject({
    ready: false,
  })
  const live = await create()
  await t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer())
  const owner = await authenticate(t, email, false)
  expect(await owner.query(api.reports.summary, args)).toMatchObject({
    ready: true,
    collected: 252500,
    refunded: 0,
    unpaidAmount: 12500,
    unpaidCount: 5,
  })
  const firstPage = await owner.query(api.reports.collections, {
    ...args,
    paginationOpts: { cursor: null, numItems: 50 },
  })
  const secondPage = await owner.query(api.reports.collections, {
    ...args,
    paginationOpts: { cursor: firstPage.continueCursor, numItems: 60 },
  })
  expect(
    new Set([...firstPage.page, ...secondPage.page].map((row) => row._id)).size
  ).toBe(101)
  const unpaid = await owner.query(api.reports.unpaid, {
    storeId,
    paginationOpts: { cursor: null, numItems: 10 },
  })
  expect(new Set(unpaid.page.map((row) => row._id))).toEqual(
    new Set([...ids.slice(101), live])
  )
})
