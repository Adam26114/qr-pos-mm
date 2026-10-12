import { expect, test } from "vitest"
import { api } from "./_generated/api"
import { authenticate, backend } from "../test/convex"

async function cafe() {
  const t = backend()
  const owner = await authenticate(t, "guest-orders@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Guest Cafe",
  })
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "Drinks",
  })
  const item = {
    storeId,
    categoryId,
    name: "လက်ဖက်ရည် Tea",
    description: "With milk",
    price: 2500,
    available: true,
    photoId: null,
  }
  const itemId = await owner.mutation(api.menu.saveItem, item)
  const tableId = await owner.mutation(api.tables.add, { storeId, number: 4 })
  const command = {
    storeId,
    tableId,
    token: "a".repeat(64),
    lines: [{ itemId, quantity: 2, expectedPrice: 2500 }],
    note: "No sugar · သကြားမပါ",
  }
  return { t, owner, storeId, categoryId, itemId, item, tableId, command }
}

test("a seated guest gets a fixed separate bill and only a private capability can track it", async () => {
  const { t, owner, storeId, itemId, item, command } = await cafe()
  const orderId = await t.mutation(api.guestOrders.submit, command)
  const receipt = await t.query(api.guestOrders.track, { token: command.token })
  expect(receipt).toEqual({
    store: { _id: storeId, name: "Guest Cafe" },
    order: {
      _id: orderId,
      createdAt: expect.any(Number),
      source: "qr",
      paymentMethod: "cash",
      status: "pending",
      destination: { kind: "table", number: 4 },
      lines: [{ itemId, name: "လက်ဖက်ရည် Tea", unitPrice: 2500, quantity: 2 }],
      note: "No sugar · သကြားမပါ",
      total: 5000,
    },
    paid: false,
    money: { collected: 0, refunded: 0, due: 5000 },
    cashOnly: true,
  })
  const second = await t.mutation(api.guestOrders.submit, {
    ...command,
    token: "b".repeat(64),
  })
  expect(second).not.toBe(orderId)
  expect(
    (await owner.query(api.orders.queue, { storeId })).map((order) => order._id)
  ).toEqual([orderId, second])
  for (const token of [orderId, "4", "c".repeat(64)])
    expect(await t.query(api.guestOrders.track, { token })).toBeNull()
  await expect(
    t.query(api.orders.detail, { storeId, orderId })
  ).rejects.toThrow("Unauthenticated")
  await expect(
    t.mutation(api.orders.recordCash, { storeId, orderId })
  ).rejects.toThrow("Unauthenticated")
  await owner.mutation(api.menu.saveItem, {
    ...item,
    itemId,
    price: 9000,
    name: "New tea",
    available: false,
  })
  await owner.mutation(api.menu.removeItem, { storeId, itemId })
  await owner.mutation(api.tables.remove, { storeId, tableId: command.tableId })
  expect(
    (await t.query(api.guestOrders.track, { token: command.token }))!.order
  ).toMatchObject({
    total: 5000,
    lines: [{ name: "လက်ဖက်ရည် Tea", unitPrice: 2500 }],
    destination: { kind: "table", number: 4 },
  })
})

test("concurrent retries recover one accepted bill even after the trial, table and menu expire", async () => {
  const { t, owner, storeId, itemId, command } = await cafe()
  const [first, retry] = await Promise.all([
    t.mutation(api.guestOrders.submit, command),
    t.mutation(api.guestOrders.submit, command),
  ])
  expect(retry).toBe(first)
  expect(await owner.query(api.orders.queue, { storeId })).toHaveLength(1)
  await owner.mutation(api.tables.remove, { storeId, tableId: command.tableId })
  await owner.mutation(api.menu.removeItem, { storeId, itemId })
  await t.run((ctx) => ctx.db.patch(storeId, { trialEndsAt: Date.now() - 1 }))
  expect(await t.query(api.guestOrders.accepting, { storeId })).toBe(false)
  expect(await t.mutation(api.guestOrders.submit, command)).toBe(first)
  await expect(
    t.mutation(api.guestOrders.submit, { ...command, note: "Changed" })
  ).rejects.toThrow("SUBMISSION_KEY_REUSED")
  await expect(
    t.mutation(api.guestOrders.submit, { ...command, token: "b".repeat(64) })
  ).rejects.toThrow("STORE_ACCESS_EXPIRED")
  expect(
    (await t.query(api.guestOrders.track, { token: command.token }))?.order
      .total
  ).toBe(5000)
})

test("server acceptance checks current prices, availability, valid quantities and safe totals", async () => {
  const { t, owner, storeId, itemId, item, command } = await cafe()
  expect(await t.query(api.guestOrders.accepting, { storeId })).toBe(true)
  for (const quantity of [0, -1, 1.5, 100, NaN])
    await expect(
      t.mutation(api.guestOrders.submit, {
        ...command,
        lines: [{ itemId, quantity, expectedPrice: 2500 }],
      })
    ).rejects.toThrow("INVALID_ORDER")
  for (const input of [
    { ...command, lines: [] },
    { ...command, lines: [...command.lines, ...command.lines] },
    { ...command, note: "x".repeat(2001) },
    { ...command, token: "guessable" },
  ])
    await expect(t.mutation(api.guestOrders.submit, input)).rejects.toThrow(
      "INVALID_ORDER"
    )
  await expect(
    t.mutation(api.guestOrders.submit, {
      ...command,
      lines: [{ itemId, quantity: 2, expectedPrice: 2000 }],
    })
  ).rejects.toThrow("PRICE_CHANGED")
  await owner.mutation(api.menu.saveItem, { ...item, itemId, available: false })
  await expect(t.mutation(api.guestOrders.submit, command)).rejects.toThrow(
    "ITEM_UNAVAILABLE"
  )
  await owner.mutation(api.menu.saveItem, {
    ...item,
    itemId,
    price: Number.MAX_SAFE_INTEGER,
  })
  await expect(
    t.mutation(api.guestOrders.submit, {
      ...command,
      lines: [{ itemId, quantity: 2, expectedPrice: Number.MAX_SAFE_INTEGER }],
    })
  ).rejects.toThrow("INVALID_ORDER")
  expect(await owner.query(api.orders.queue, { storeId })).toHaveLength(0)
})

test("a guest cannot submit another store's items or tables, or use a removed table", async () => {
  const { t, owner, storeId, command } = await cafe()
  const other = await authenticate(t, "other-guest-cafe@example.com")
  const otherStore = await other.mutation(api.stores.create, {
    name: "Other Cafe",
  })
  const categoryId = await other.mutation(api.menu.saveCategory, {
    storeId: otherStore,
    name: "Other",
  })
  const otherItem = await other.mutation(api.menu.saveItem, {
    storeId: otherStore,
    categoryId,
    name: "Other tea",
    description: "",
    price: 2500,
    available: true,
    photoId: null,
  })
  const otherTable = await other.mutation(api.tables.add, {
    storeId: otherStore,
    number: 4,
  })
  await expect(
    t.mutation(api.guestOrders.submit, { ...command, tableId: otherTable })
  ).rejects.toThrow("INVALID_TABLE")
  await expect(
    t.mutation(api.guestOrders.submit, {
      ...command,
      lines: [{ itemId: otherItem, quantity: 1, expectedPrice: 2500 }],
    })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  await owner.mutation(api.tables.remove, { storeId, tableId: command.tableId })
  await expect(t.mutation(api.guestOrders.submit, command)).rejects.toThrow(
    "TABLE_REMOVED"
  )
  expect(await owner.query(api.orders.queue, { storeId })).toHaveLength(0)
})

test("a receipt observes authoritative payment and status changes without exposing its capability to the queue", async () => {
  const { t, owner, storeId, command } = await cafe()
  const orderId = await t.mutation(api.guestOrders.submit, command)
  const input = { storeId, orderId }
  const detail = await owner.query(api.orders.detail, input)
  expect(JSON.stringify(detail)).not.toContain(command.token)
  expect(
    await t.query(api.guestOrders.track, { token: detail.order.submissionKey })
  ).toBeNull()
  await owner.mutation(api.orders.recordCash, input)
  expect(
    await t.query(api.guestOrders.track, { token: command.token })
  ).toMatchObject({ paid: true, order: { status: "pending" } })
  await owner.mutation(api.orders.startCooking, input)
  expect(
    await t.query(api.guestOrders.track, { token: command.token })
  ).toMatchObject({ paid: true, order: { status: "cooking" } })
  await owner.mutation(api.orders.markServed, input)
  expect(
    await t.query(api.guestOrders.track, { token: command.token })
  ).toMatchObject({ paid: true, order: { status: "served", total: 5000 } })
})
