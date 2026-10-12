import { expect, test, vi } from "vitest"
import { api, internal } from "./_generated/api"
import { backend, authenticate } from "../test/convex"

async function cafe() {
  const t = backend()
  const owner = await authenticate(t, `${crypto.randomUUID()}@example.com`)
  const storeId = await owner.mutation(api.stores.create, {
    name: "Refund Cafe",
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
  const orderId = await owner.mutation(api.orders.createCounter, {
    storeId,
    submissionKey: crypto.randomUUID(),
    lines: [{ itemId, quantity: 1, expectedPrice: 2500 }],
    note: "No sugar",
  })
  return { t, owner, storeId, orderId }
}

test("owner cancellation preserves a paid cooking bill and stops further operations", async () => {
  const { owner, storeId, orderId } = await cafe()
  const command = { storeId, orderId }
  await owner.mutation(api.orders.recordCash, command)
  await owner.mutation(api.orders.assignDestination, {
    ...command,
    destination: { kind: "takeaway" },
  })
  await owner.mutation(api.orders.startCooking, command)
  const before = await owner.query(api.orders.detail, command)
  const cancel = {
    ...command,
    requestKey: "cancel-first",
    reason: "Kitchen closed",
  }
  await owner.mutation(api.orders.cancel, cancel)
  await owner.mutation(api.orders.cancel, cancel)
  const after = await owner.query(api.orders.detail, command)
  expect(after.order).toMatchObject({
    status: "cancelled",
    lines: before.order.lines,
    total: 2500,
    cookingAt: before.order.cookingAt,
  })
  expect(after.order.cancellation).toMatchObject({
    reason: "Kitchen closed",
    actorName: "Cafe team member",
  })
  expect(after.payment?.amount).toBe(2500)
  expect(after.refunds).toEqual([])
  expect(
    after.events.filter((event) => event.kind === "cancelled")
  ).toHaveLength(1)
  expect(await owner.query(api.orders.queue, { storeId })).toEqual([])
  for (const operation of [
    api.orders.recordCash,
    api.orders.startCooking,
    api.orders.markServed,
  ])
    await expect(owner.mutation(operation, command)).rejects.toThrow(
      "ORDER_CANCELLED"
    )
  await expect(
    owner.mutation(api.orders.assignDestination, {
      ...command,
      destination: { kind: "takeaway" },
    })
  ).rejects.toThrow("ORDER_CANCELLED")
  await expect(
    owner.mutation(api.orders.cancel, { ...cancel, reason: "Changed" })
  ).rejects.toThrow("COMMAND_KEY_REUSED")
})

test("full refunds require cancellation for active required payments and preserve served collection history", async () => {
  const { owner, storeId, orderId } = await cafe()
  const command = { storeId, orderId }
  await owner.mutation(api.orders.recordCash, command)
  const detail = await owner.query(api.orders.detail, command)
  const refund = {
    ...command,
    collectionId: detail.collections[0]!._id,
    requestKey: "refund-first",
    reason: "Cash returned",
  }
  await expect(owner.mutation(api.orders.recordRefund, refund)).rejects.toThrow(
    "CANCEL_BEFORE_REFUND"
  )
  await owner.mutation(api.orders.assignDestination, {
    ...command,
    destination: { kind: "takeaway" },
  })
  await owner.mutation(api.orders.startCooking, command)
  await owner.mutation(api.orders.markServed, command)
  const served = await owner.query(api.orders.detail, command)
  const first = await owner.mutation(api.orders.recordRefund, refund)
  expect(await owner.mutation(api.orders.recordRefund, refund)).toBe(first)
  await expect(
    owner.mutation(api.orders.recordRefund, {
      ...refund,
      requestKey: "another-refund",
    })
  ).rejects.toThrow("ALREADY_REFUNDED")
  await expect(
    owner.mutation(api.orders.recordRefund, {
      ...refund,
      reason: "Changed reason",
    })
  ).rejects.toThrow("COMMAND_KEY_REUSED")
  const after = await owner.query(api.orders.detail, command)
  expect(after.order).toMatchObject({
    status: "served",
    servedAt: served.order.servedAt,
  })
  expect(after.payment?.amount).toBe(2500)
  expect(after.refunds).toHaveLength(1)
  expect(after.refunds[0]).toMatchObject({
    amount: 2500,
    method: "cash",
    currency: "MMK",
    reason: "Cash returned",
    uncertainChronology: false,
  })
  expect(after.money).toMatchObject({
    collected: 2500,
    refunded: 2500,
    retained: 0,
    due: 0,
  })
  expect(
    after.events.filter((event) => event.kind === "refund_recorded")
  ).toHaveLength(1)
  expect(await owner.query(api.orders.queue, { storeId })).toEqual([])
})

test("only current same-store owners cancel or refund, and guests see outcomes without internal reasons", async () => {
  const { t, owner, storeId, orderId } = await cafe()
  const staff = await authenticate(
    t,
    `staff-${crypto.randomUUID()}@example.com`
  )
  const invitation = await owner.action(api.staff.createJoinLink, { storeId })
  await staff.mutation(api.staff.accept, { token: invitation.token })
  const outsider = await authenticate(
    t,
    `outsider-${crypto.randomUUID()}@example.com`
  )
  const otherStore = await outsider.mutation(api.stores.create, {
    name: "Other",
  })
  await owner.mutation(api.orders.recordCash, { storeId, orderId })
  const detail = await owner.query(api.orders.detail, { storeId, orderId })
  const refund = {
    storeId,
    orderId,
    collectionId: detail.collections[0]!._id,
    requestKey: "private-refund",
    reason: "Internal refund reason",
  }
  const cancel = {
    storeId,
    orderId,
    requestKey: "private-cancel",
    reason: "Internal kitchen reason",
  }
  for (const actor of [staff, outsider, t]) {
    await expect(actor.mutation(api.orders.cancel, cancel)).rejects.toThrow()
    await expect(
      actor.mutation(api.orders.recordRefund, refund)
    ).rejects.toThrow()
  }
  await expect(
    outsider.mutation(api.orders.cancel, { ...cancel, storeId: otherStore })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  const menu = await owner.query(api.menu.manage, { storeId })
  const tableId = await owner.mutation(api.tables.add, { storeId, number: 1 })
  const token = "a".repeat(64)
  const guestId = await t.mutation(api.guestOrders.submit, {
    storeId,
    token,
    tableId,
    lines: [{ itemId: menu.items[0]!._id, quantity: 1, expectedPrice: 2500 }],
    note: "Guest note",
  })
  await owner.mutation(api.orders.recordCash, { storeId, orderId: guestId })
  await owner.mutation(api.orders.cancel, { ...cancel, orderId: guestId })
  const guestDetail = await owner.query(api.orders.detail, {
    storeId,
    orderId: guestId,
  })
  await owner.mutation(api.orders.recordRefund, {
    ...refund,
    orderId: guestId,
    collectionId: guestDetail.collections[0]!._id,
  })
  const tracked = await t.query(api.guestOrders.track, { token })
  expect(tracked).toMatchObject({
    order: { status: "cancelled", total: 2500 },
    paid: true,
    money: { collected: 2500, refunded: 2500, due: 0 },
  })
  expect(JSON.stringify(tracked)).not.toMatch(
    /Internal|actorId|actorName|reference|cancellation|requestKey|events/
  )
  const history = await staff.query(api.orders.history, {
    storeId,
    paginationOpts: { cursor: null, numItems: 20 },
  })
  expect(history.page.map((order) => order._id)).toEqual([guestId])
  expect(history.page[0]!.status).toBe("cancelled")
})

test("excess refunds preserve funded work and distinguish actual time from late verification", async () => {
  const { t, owner, storeId, orderId } = await cafe()
  const command = { storeId, orderId }
  await owner.mutation(api.orders.recordCash, command)
  const at = Date.now()
  // Fixture represents confirmed provider money; no client-facing payment assertion API exists.
  const extra = await t.run((ctx) =>
    ctx.db.insert("orderCollections", {
      ...command,
      amount: 2500,
      currency: "MMK",
      method: "mmqr",
      reference: "actual-extra-transaction",
      collectedAt: at,
      timeSource: "verification_fallback",
      recordedAt: at,
      recordedBy: "provider",
    })
  )
  const input = {
    ...command,
    collectionId: extra,
    requestKey: "refund-excess",
    reason: "Duplicate collection returned",
    completedAt: at - 60_000,
  }
  const [first, second] = await Promise.all([
    owner.mutation(api.orders.recordRefund, input),
    owner.mutation(api.orders.recordRefund, input),
  ])
  expect(second).toBe(first)
  const detail = await owner.query(api.orders.detail, command)
  expect(detail.order.status).toBe("pending")
  expect(detail.money).toMatchObject({
    collected: 5000,
    refunded: 2500,
    retained: 2500,
    funded: true,
  })
  expect(detail.refunds[0]).toMatchObject({
    uncertainChronology: true,
    collectionTimeSource: "verification_fallback",
    collectedAt: at,
    completedAt: at - 60_000,
    reference: "actual-extra-transaction",
  })
  const required = {
    ...input,
    collectionId: detail.collections[0]!._id,
    requestKey: "refund-required",
    completedAt: undefined,
  }
  await expect(
    owner.mutation(api.orders.recordRefund, required)
  ).rejects.toThrow("CANCEL_BEFORE_REFUND")
  await owner.mutation(api.orders.cancel, {
    ...command,
    requestKey: "cancel-required",
    reason: "Stopped",
  })
  for (const completedAt of [at + 60_000, at - 60_000, -1, 1.5])
    await expect(
      owner.mutation(api.orders.recordRefund, { ...required, completedAt })
    ).rejects.toThrow("INVALID_REFUND_DATE")
  await owner.mutation(api.orders.recordRefund, required)
  const final = await owner.query(api.orders.detail, command)
  expect(final.money).toMatchObject({
    collected: 5000,
    refunded: 5000,
    retained: 0,
    due: 0,
  })
  expect(final.refunds).toHaveLength(2)
})

test("legacy receipts migrate once with unchanged provenance and accepted orders remain operable after expiry", async () => {
  vi.useFakeTimers()
  try {
    const { t, owner, storeId, orderId } = await cafe()
    const command = { storeId, orderId }
    const receivedAt = Date.now() - 60_000
    await t.run(async (ctx) => {
      await ctx.db.insert("cashPayments", {
        ...command,
        amount: 2500,
        receivedAt,
        recordedBy: "original-cashier",
      })
      await ctx.db.patch(storeId, { trialEndsAt: Date.now() - 1 })
    })
    const old = await owner.query(api.orders.detail, command)
    expect(old.money.collected).toBe(2500)
    await owner.mutation(api.orders.cancel, {
      ...command,
      requestKey: "legacy-cancel",
      reason: "No stock",
    })
    const input = {
      ...command,
      collectionId: old.collections[0]!._id,
      requestKey: "legacy-refund",
      reason: "Cash returned",
      completedAt: Date.now() - 30_000,
    }
    const result = await owner.mutation(api.orders.recordRefund, input)
    for (let index = 0; index < 2; index++) {
      await t.mutation(internal.orders.migrateRecords, { phase: "cash" })
      vi.advanceTimersByTime(0)
      await t.finishInProgressScheduledFunctions()
    }
    expect(await owner.mutation(api.orders.recordRefund, input)).toBe(result)
    const detail = await owner.query(api.orders.detail, command)
    expect(detail.collections).toHaveLength(1)
    expect(detail.collections[0]).toMatchObject({
      amount: 2500,
      collectedAt: receivedAt,
      timeSource: "cash_recorded",
      recordedBy: "original-cashier",
      recordedAt: receivedAt,
    })
    expect(detail.money).toMatchObject({ collected: 2500, refunded: 2500 })
    const history = await owner.query(api.orders.history, {
      storeId,
      status: "cancelled",
      paginationOpts: { cursor: null, numItems: 1 },
    })
    expect(history.page.map((order) => order._id)).toEqual([orderId])
  } finally {
    vi.useRealTimers()
  }
})

test("cancellation races settle into one terminal state and reject invalid reasons, unpaid or partial refunds", async () => {
  const { t, owner, storeId, orderId } = await cafe()
  const command = { storeId, orderId }
  const cancellation = {
    ...command,
    requestKey: "cancel-race",
    reason: "Stopped",
  }
  await expect(
    owner.mutation(api.orders.cancel, { ...cancellation, reason: "   " })
  ).rejects.toThrow("INVALID_CANCELLATION")
  await owner.mutation(api.orders.recordCash, command)
  const collectionId = (await owner.query(api.orders.detail, command))
    .collections[0]!._id
  const refund = {
    ...command,
    collectionId,
    requestKey: "invalid-refund",
    reason: "Cash returned",
  }
  const partial = { ...refund, amount: 1 }
  await expect(
    owner.mutation(api.orders.recordRefund, partial)
  ).rejects.toThrow()
  await expect(
    owner.mutation(api.orders.recordRefund, { ...refund, reason: " " })
  ).rejects.toThrow("INVALID_REFUND")
  await owner.mutation(api.orders.assignDestination, {
    ...command,
    destination: { kind: "takeaway" },
  })
  await owner.mutation(api.orders.startCooking, command)
  const race = await Promise.allSettled([
    owner.mutation(api.orders.cancel, cancellation),
    owner.mutation(api.orders.markServed, command),
  ])
  expect(race.filter((result) => result.status === "fulfilled")).toHaveLength(1)
  const final = await owner.query(api.orders.detail, command)
  expect(["served", "cancelled"]).toContain(final.order.status)
  const menu = await owner.query(api.menu.manage, { storeId })
  const unpaid = await owner.mutation(api.orders.createCounter, {
    storeId,
    submissionKey: crypto.randomUUID(),
    lines: [{ itemId: menu.items[0]!._id, quantity: 1, expectedPrice: 2500 }],
    note: "Unpaid",
  })
  await expect(
    owner.mutation(api.orders.recordRefund, { ...refund, orderId: unpaid })
  ).rejects.toThrow("INVALID_COLLECTION")
  await owner.mutation(api.orders.cancel, {
    ...cancellation,
    orderId: unpaid,
    requestKey: "cancel-unpaid",
  })
  await expect(
    owner.mutation(api.orders.recordCash, { storeId, orderId: unpaid })
  ).rejects.toThrow("ORDER_CANCELLED")
  expect(
    (await owner.query(api.orders.detail, { storeId, orderId: unpaid })).money
  ).toMatchObject({ collected: 0, due: 0 })
  await expect(t.mutation(api.orders.recordRefund, refund)).rejects.toThrow()
})

test("cancellation retry keys protect the whole store command and legacy served history survives backfill", async () => {
  const { t, owner, storeId, orderId } = await cafe()
  const menu = await owner.query(api.menu.manage, { storeId })
  const create = () =>
    owner.mutation(api.orders.createCounter, {
      storeId,
      submissionKey: crypto.randomUUID(),
      lines: [{ itemId: menu.items[0]!._id, quantity: 1, expectedPrice: 2500 }],
      note: "Other bill",
    })
  const second = await create()
  const legacy = await create()
  // Existing served order created by the previously deployed schema.
  await t.run((ctx) =>
    ctx.db.patch(legacy, { status: "served", servedAt: Date.now() })
  )
  const cancel = {
    storeId,
    orderId,
    requestKey: "same-cancel-key",
    reason: "Kitchen closed",
  }
  await owner.mutation(api.orders.cancel, cancel)
  await expect(
    owner.mutation(api.orders.cancel, { ...cancel, orderId: second })
  ).rejects.toThrow("COMMAND_KEY_REUSED")
  const read = (cursor: string | null) =>
    owner.query(api.orders.history, {
      storeId,
      paginationOpts: { numItems: 1, cursor },
    })
  const before = await read(null)
  expect(before.page.map((order) => order._id)).toEqual([legacy])
  const next = await read(before.continueCursor)
  expect(next.page.map((order) => order._id)).toEqual([orderId])
  await t.mutation(internal.orders.migrateRecords, { phase: "orders" })
  expect(
    (await read(before.continueCursor)).page.map((order) => order._id)
  ).toEqual([orderId])
  const bounded = await owner.query(api.orders.history, {
    storeId,
    paginationOpts: {
      numItems: 20,
      cursor: null,
      endCursor: before.continueCursor,
    },
  })
  expect(bounded.page.map((order) => order._id)).toEqual([legacy])
  const after = await read(null)
  expect(after.page.map((order) => order._id)).toEqual([legacy])
  expect(
    (await read(after.continueCursor)).page.map((order) => order._id)
  ).toEqual([orderId])
  expect(
    (await owner.query(api.orders.detail, { storeId, orderId: second })).order
      .status
  ).toBe("pending")
})
