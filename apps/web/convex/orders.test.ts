import { expect, test } from "vitest"
import { api } from "./_generated/api"
import { backend, authenticate } from "../test/convex"

async function cafe(email: string) {
  const t = backend()
  const owner = await authenticate(t, email)
  const storeId = await owner.mutation(api.stores.create, {
    name: "Counter Cafe",
  })
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "Drinks",
  })
  const itemId = await owner.mutation(api.menu.saveItem, {
    storeId,
    categoryId,
    name: "လက်ဖက်ရည် Tea",
    description: "With milk",
    price: 2500,
    available: true,
    photoId: null,
  })
  return { t, owner, storeId, categoryId, itemId }
}

test("a counter bill requires cash and a destination before cooking, with fixed submitted items", async () => {
  const { owner, storeId, itemId, categoryId } = await cafe(
    "counter@example.com"
  )
  const orderId = await owner.mutation(api.orders.createCounter, {
    storeId,
    submissionKey: "first-counter-order",
    lines: [{ itemId, quantity: 2, expectedPrice: 2500 }],
    note: "No sugar · သကြားမပါ",
  })
  const command = { storeId, orderId }
  expect(await owner.query(api.orders.detail, command)).toMatchObject({
    order: {
      total: 5000,
      note: "No sugar · သကြားမပါ",
      status: "pending",
      destination: null,
      lines: [{ name: "လက်ဖက်ရည် Tea", unitPrice: 2500, quantity: 2 }],
    },
    payment: null,
  })
  await expect(
    owner.mutation(api.orders.assignDestination, {
      ...command,
      destination: { kind: "takeaway" },
    })
  ).rejects.toThrow("PAYMENT_REQUIRED")
  await expect(
    owner.mutation(api.orders.startCooking, command)
  ).rejects.toThrow("PAYMENT_REQUIRED")
  await expect(owner.mutation(api.orders.markServed, command)).rejects.toThrow(
    "ORDER_NOT_COOKING"
  )
  await owner.mutation(api.orders.recordCash, command)
  await owner.mutation(api.orders.recordCash, command)
  await expect(
    owner.mutation(api.orders.startCooking, command)
  ).rejects.toThrow("DESTINATION_REQUIRED")
  await owner.mutation(api.orders.assignDestination, {
    ...command,
    destination: { kind: "takeaway" },
  })
  await owner.mutation(api.orders.startCooking, command)
  await owner.mutation(api.orders.markServed, command)
  await owner.mutation(api.orders.markServed, command)
  await owner.mutation(api.menu.saveItem, {
    storeId,
    categoryId,
    itemId,
    name: "New tea",
    description: "",
    price: 9000,
    available: false,
    photoId: null,
  })
  await owner.mutation(api.menu.removeItem, { storeId, itemId })
  const detail = await owner.query(api.orders.detail, command)
  expect(detail).toMatchObject({
    order: {
      status: "served",
      total: 5000,
      lines: [{ name: "လက်ဖက်ရည် Tea", unitPrice: 2500 }],
    },
    payment: { amount: 5000 },
  })
  expect(
    detail.events.filter((event) => event.kind === "cash_received")
  ).toHaveLength(1)
  expect(await owner.query(api.orders.queue, { storeId })).toEqual([])
})

test("retrying an accepted submission recovers one bill despite expiry and menu changes", async () => {
  const { t, owner, storeId, itemId } = await cafe("retry-counter@example.com")
  const input = {
    storeId,
    submissionKey: "retry-counter-order",
    lines: [{ itemId, quantity: 1, expectedPrice: 2500 }],
    note: "",
  }
  const [first, second] = await Promise.all([
    owner.mutation(api.orders.createCounter, input),
    owner.mutation(api.orders.createCounter, input),
  ])
  expect(second).toBe(first)
  await owner.mutation(api.menu.removeItem, { storeId, itemId })
  await t.run((ctx) => ctx.db.patch(storeId, { trialEndsAt: Date.now() - 1 }))
  expect(await owner.mutation(api.orders.createCounter, input)).toBe(first)
  expect(
    await owner.query(api.orders.submission, {
      storeId,
      submissionKey: input.submissionKey,
    })
  ).toBe(first)
  await expect(
    owner.mutation(api.orders.createCounter, { ...input, note: "Changed" })
  ).rejects.toThrow("SUBMISSION_KEY_REUSED")
  await expect(
    owner.mutation(api.orders.createCounter, {
      ...input,
      submissionKey: "new-after-expiry",
    })
  ).rejects.toThrow("STORE_ACCESS_EXPIRED")
  await owner.mutation(api.orders.recordCash, { storeId, orderId: first })
  await owner.mutation(api.orders.assignDestination, {
    storeId,
    orderId: first,
    destination: { kind: "takeaway" },
  })
  await owner.mutation(api.orders.startCooking, { storeId, orderId: first })
  await owner.mutation(api.orders.markServed, { storeId, orderId: first })
  expect(
    (await owner.query(api.orders.detail, { storeId, orderId: first })).order
      .status
  ).toBe("served")
})

test("owners manage tables, staff process bills and corrections retain historical destinations", async () => {
  const { t, owner, storeId, itemId } = await cafe("table-owner@example.com")
  const staff = await authenticate(t, "counter-staff@example.com")
  const staffUser = await staff.query(api.auth.getAuthUser)
  const membershipId = await t.run((ctx) =>
    ctx.db.insert("memberships", {
      userId: staffUser._id,
      storeId,
      role: "staff",
    })
  )
  const other = await authenticate(t, "counter-other@example.com")
  const otherStore = await other.mutation(api.stores.create, {
    name: "Other Cafe",
  })
  const tableId = await owner.mutation(api.tables.add, { storeId, number: 4 })
  const otherTable = await other.mutation(api.tables.add, {
    storeId: otherStore,
    number: 4,
  })
  await expect(
    owner.mutation(api.tables.add, { storeId, number: 4 })
  ).rejects.toThrow("TABLE_EXISTS")
  await expect(
    staff.mutation(api.tables.add, { storeId, number: 5 })
  ).rejects.toThrow("OWNER_REQUIRED")
  const input = {
    storeId,
    submissionKey: "staff-counter-order",
    lines: [{ itemId, quantity: 1, expectedPrice: 2500 }],
    note: "",
  }
  const orderId = await staff.mutation(api.orders.createCounter, input)
  const command = { storeId, orderId }
  await Promise.all([
    staff.mutation(api.orders.recordCash, command),
    owner.mutation(api.orders.recordCash, command),
  ])
  await expect(
    staff.mutation(api.orders.assignDestination, {
      ...command,
      destination: { kind: "table", tableId: otherTable },
    })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  await staff.mutation(api.orders.assignDestination, {
    ...command,
    destination: { kind: "table", tableId },
  })
  await owner.mutation(api.tables.remove, { storeId, tableId })
  expect(
    (await staff.query(api.orders.detail, command)).order.destination
  ).toMatchObject({ kind: "table", number: 4 })
  await staff.mutation(api.orders.startCooking, command)
  const nextTable = await owner.mutation(api.tables.add, { storeId, number: 4 })
  await staff.mutation(api.orders.assignDestination, {
    ...command,
    destination: { kind: "table", tableId: nextTable },
  })
  const detail = await staff.query(api.orders.detail, command)
  expect(detail.payment?.amount).toBe(2500)
  expect(
    detail.events.filter((event) => event.kind === "cash_received")
  ).toHaveLength(1)
  expect(
    detail.events.filter((event) => event.kind === "destination_changed")[1]
  ).toMatchObject({
    actorId: staffUser._id,
    previousDestination: { kind: "table", tableId, number: 4 },
    destination: { kind: "table", tableId: nextTable, number: 4 },
  })
  for (const actor of [t, other]) {
    await expect(actor.query(api.orders.queue, { storeId })).rejects.toThrow()
    await expect(actor.query(api.orders.detail, command)).rejects.toThrow()
    await expect(
      actor.mutation(api.orders.recordCash, command)
    ).rejects.toThrow()
    await expect(
      actor.mutation(api.orders.createCounter, input)
    ).rejects.toThrow()
  }
  await t.run((ctx) => ctx.db.patch(membershipId, { revokedAt: Date.now() }))
  await expect(staff.query(api.orders.detail, command)).rejects.toThrow(
    "STORE_ACCESS_DENIED"
  )
  await expect(staff.mutation(api.orders.markServed, command)).rejects.toThrow(
    "STORE_ACCESS_DENIED"
  )
})

test("initial acceptance rejects stale prices, unavailable items, unsafe totals and invalid quantities", async () => {
  const { owner, storeId, itemId, categoryId } = await cafe(
    "validation-counter@example.com"
  )
  const input = {
    storeId,
    submissionKey: "validation-order",
    lines: [{ itemId, quantity: 1, expectedPrice: 2500 }],
    note: "",
  }
  for (const quantity of [0, -1, 1.5, 100, NaN])
    await expect(
      owner.mutation(api.orders.createCounter, {
        ...input,
        lines: [{ itemId, quantity, expectedPrice: 2500 }],
      })
    ).rejects.toThrow("INVALID_ORDER")
  await expect(
    owner.mutation(api.orders.createCounter, { ...input, lines: [] })
  ).rejects.toThrow("INVALID_ORDER")
  await expect(
    owner.mutation(api.orders.createCounter, {
      ...input,
      lines: [...input.lines, ...input.lines],
    })
  ).rejects.toThrow("INVALID_ORDER")
  await expect(
    owner.mutation(api.orders.createCounter, {
      ...input,
      note: "x".repeat(2001),
    })
  ).rejects.toThrow("INVALID_ORDER")
  await expect(
    owner.mutation(api.orders.createCounter, {
      ...input,
      lines: [{ itemId, quantity: 1, expectedPrice: 2000 }],
    })
  ).rejects.toThrow("PRICE_CHANGED")
  const values = {
    storeId,
    itemId,
    categoryId,
    name: "Tea",
    description: "",
    available: false,
    price: 2500,
    photoId: null,
  }
  await owner.mutation(api.menu.saveItem, values)
  await expect(owner.mutation(api.orders.createCounter, input)).rejects.toThrow(
    "ITEM_UNAVAILABLE"
  )
  await owner.mutation(api.menu.saveItem, {
    ...values,
    available: true,
    price: Number.MAX_SAFE_INTEGER,
  })
  await expect(
    owner.mutation(api.orders.createCounter, {
      ...input,
      lines: [{ itemId, quantity: 2, expectedPrice: Number.MAX_SAFE_INTEGER }],
    })
  ).rejects.toThrow("INVALID_ORDER")
  await owner.mutation(api.menu.saveItem, { ...values, available: true })
  const first = await owner.mutation(api.orders.createCounter, input)
  const second = await owner.mutation(api.orders.createCounter, {
    ...input,
    submissionKey: "separate-bill-key",
  })
  expect(first).not.toBe(second)
  const tableId = await owner.mutation(api.tables.add, { storeId, number: 7 })
  for (const orderId of [first, second]) {
    const command = { storeId, orderId }
    await owner.mutation(api.orders.recordCash, command)
    await owner.mutation(api.orders.assignDestination, {
      ...command,
      destination: { kind: "table", tableId },
    })
  }
  await owner.mutation(api.tables.remove, { storeId, tableId })
  await expect(
    owner.mutation(api.orders.assignDestination, {
      storeId,
      orderId: first,
      destination: { kind: "table", tableId },
    })
  ).rejects.toThrow("TABLE_REMOVED")
  expect(await owner.query(api.orders.queue, { storeId })).toHaveLength(2)
  for (const number of [0, -1, 1.5, 10000])
    await expect(
      owner.mutation(api.tables.add, { storeId, number })
    ).rejects.toThrow("INVALID_TABLE")
})

test("staff recover paid unassigned counter bills after expiry and finish accepted unpaid bills", async () => {
  const { t, owner, storeId, itemId } = await cafe(
    "expired-counter@example.com"
  )
  const staff = await authenticate(t, "expired-counter-staff@example.com")
  const staffUser = await staff.query(api.auth.getAuthUser)
  await t.run((ctx) =>
    ctx.db.insert("memberships", {
      userId: staffUser._id,
      storeId,
      role: "staff",
    })
  )
  const input = {
    storeId,
    submissionKey: "paid-before-expiry",
    lines: [{ itemId, quantity: 2, expectedPrice: 2500 }],
    note: "Keep this bill",
  }
  const paid = await staff.mutation(api.orders.createCounter, input)
  const unpaid = await staff.mutation(api.orders.createCounter, {
    ...input,
    submissionKey: "unpaid-before-expiry",
  })
  await staff.mutation(api.orders.recordCash, { storeId, orderId: paid })
  await t.run((ctx) => ctx.db.patch(storeId, { trialEndsAt: Date.now() - 1 }))
  expect(await staff.query(api.orders.queue, { storeId })).toMatchObject([
    {
      _id: paid,
      status: "pending",
      destination: null,
      payment: { amount: 5000 },
    },
    { _id: unpaid, status: "pending", destination: null, payment: null },
  ])
  expect(
    await staff.query(api.orders.submission, {
      storeId,
      submissionKey: input.submissionKey,
    })
  ).toBe(paid)
  expect(await staff.mutation(api.orders.createCounter, input)).toBe(paid)
  for (const actor of [owner, staff])
    await expect(
      actor.mutation(api.orders.createCounter, {
        ...input,
        submissionKey: "new-expired-counter",
      })
    ).rejects.toThrow("STORE_ACCESS_EXPIRED")
  await expect(
    staff.mutation(api.orders.startCooking, {
      storeId,
      orderId: paid,
    })
  ).rejects.toThrow("DESTINATION_REQUIRED")
  for (const orderId of [paid, unpaid]) {
    const command = { storeId, orderId }
    await staff.mutation(api.orders.recordCash, command)
    await staff.mutation(api.orders.assignDestination, {
      ...command,
      destination: { kind: "takeaway" },
    })
    await staff.mutation(api.orders.startCooking, command)
    await staff.mutation(api.orders.markServed, command)
    const detail = await staff.query(api.orders.detail, command)
    expect(detail).toMatchObject({
      order: {
        status: "served",
        total: 5000,
        destination: { kind: "takeaway" },
        lines: [{ name: "လက်ဖက်ရည် Tea", unitPrice: 2500, quantity: 2 }],
      },
      payment: { amount: 5000 },
    })
    expect(detail.events.map((event) => event.kind)).toEqual([
      "cash_received",
      "destination_changed",
      "cooking",
      "served",
    ])
  }
  expect(await staff.query(api.orders.queue, { storeId })).toEqual([])
  expect(
    (
      await staff.query(api.orders.history, {
        storeId,
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page
  ).toHaveLength(2)
})

test("concurrent counter assignments preserve one destination and a serialized correction history", async () => {
  const { t, owner, storeId, itemId } = await cafe(
    "assignment-owner@example.com"
  )
  const staff = await authenticate(t, "assignment-staff@example.com")
  const staffUser = await staff.query(api.auth.getAuthUser)
  await t.run((ctx) =>
    ctx.db.insert("memberships", {
      userId: staffUser._id,
      storeId,
      role: "staff",
    })
  )
  const tableId = await owner.mutation(api.tables.add, { storeId, number: 4 })
  const nextTable = await owner.mutation(api.tables.add, { storeId, number: 7 })
  const orderId = await staff.mutation(api.orders.createCounter, {
    storeId,
    submissionKey: "concurrent-assignment",
    lines: [{ itemId, quantity: 1, expectedPrice: 2500 }],
    note: "",
  })
  const command = { storeId, orderId }
  await staff.mutation(api.orders.recordCash, command)
  const assignment = {
    ...command,
    destination: { kind: "table" as const, tableId },
  }
  await Promise.all([
    staff.mutation(api.orders.assignDestination, assignment),
    owner.mutation(api.orders.assignDestination, assignment),
  ])
  const assigned = await staff.query(api.orders.detail, command)
  expect(
    assigned.events.filter((event) => event.kind === "destination_changed")
  ).toMatchObject([
    {
      previousDestination: null,
      destination: { kind: "table", tableId, number: 4 },
    },
  ])
  await Promise.all([
    staff.mutation(api.orders.assignDestination, {
      ...command,
      destination: { kind: "takeaway" },
    }),
    owner.mutation(api.orders.assignDestination, {
      ...command,
      destination: { kind: "table", tableId: nextTable },
    }),
  ])
  const detail = await staff.query(api.orders.detail, command)
  const changes = detail.events.filter(
    (event) => event.kind === "destination_changed"
  )
  expect(changes).toHaveLength(3)
  expect(changes[1]?.previousDestination).toEqual({
    kind: "table",
    tableId,
    number: 4,
  })
  expect(changes[2]?.previousDestination).toEqual(changes[1]?.destination)
  expect(detail.order.destination).toEqual(changes[2]?.destination)
  expect(
    new Set(changes.slice(1).map((event) => event.destination?.kind))
  ).toEqual(new Set(["table", "takeaway"]))
  expect(detail.payment).toEqual(assigned.payment)
  expect(detail.order).toMatchObject({ status: "pending", total: 2500 })
})
