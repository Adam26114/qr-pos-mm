import { expect, test } from "vitest"
import { api } from "./_generated/api"
import { authenticate, backend } from "../test/convex"

async function cafe() {
  const t = backend()
  const owner = await authenticate(t, "qr-ops-owner@example.com")
  const staff = await authenticate(t, "qr-ops-staff@example.com")
  const staffUser = await staff.query(api.auth.getAuthUser)
  const storeId = await owner.mutation(api.stores.create, {
    name: "Seated Cafe",
  })
  const membershipId = await t.run((ctx) =>
    ctx.db.insert("memberships", {
      storeId,
      userId: staffUser._id,
      role: "staff",
    })
  )
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "Drinks",
  })
  const itemId = await owner.mutation(api.menu.saveItem, {
    storeId,
    categoryId,
    name: "လက်ဖက်ရည် Tea",
    description: "",
    price: 2500,
    available: true,
    photoId: null,
  })
  const tableId = await owner.mutation(api.tables.add, { storeId, number: 4 })
  const input = {
    storeId,
    tableId,
    token: "a".repeat(64),
    lines: [{ itemId, quantity: 2, expectedPrice: 2500 }],
    note: "No sugar · သကြားမပါ",
  }
  const orderId = await t.mutation(api.guestOrders.submit, input)
  const command = { storeId, orderId }
  return {
    t,
    owner,
    staff,
    staffUser,
    membershipId,
    storeId,
    tableId,
    itemId,
    input,
    orderId,
    command,
  }
}

test("staff cooks and serves seated cash before collection, and concurrent collection records one money event", async () => {
  const { t, owner, staff, storeId, input, command } = await cafe()
  await expect(staff.mutation(api.orders.markServed, command)).rejects.toThrow(
    "ORDER_NOT_COOKING"
  )
  await t.run((ctx) => ctx.db.patch(storeId, { trialEndsAt: Date.now() - 1 }))
  await expect(
    t.mutation(api.guestOrders.submit, { ...input, token: "b".repeat(64) })
  ).rejects.toThrow("STORE_ACCESS_EXPIRED")
  await Promise.all([
    staff.mutation(api.orders.startCooking, command),
    owner.mutation(api.orders.startCooking, command),
  ])
  expect(
    await t.query(api.guestOrders.track, { token: input.token })
  ).toMatchObject({ paid: false, order: { status: "cooking", total: 5000 } })
  await Promise.all([
    staff.mutation(api.orders.markServed, command),
    owner.mutation(api.orders.markServed, command),
  ])
  expect(
    await t.query(api.guestOrders.track, { token: input.token })
  ).toMatchObject({ paid: false, order: { status: "served" } })
  expect(await staff.query(api.orders.queue, { storeId })).toMatchObject([
    { _id: command.orderId, status: "served", payment: null },
  ])
  await Promise.all([
    staff.mutation(api.orders.recordCash, command),
    owner.mutation(api.orders.recordCash, command),
  ])
  await staff.mutation(api.orders.startCooking, command)
  const detail = await staff.query(api.orders.detail, command)
  expect(detail.order.status).toBe("served")
  expect(detail.payment?.amount).toBe(5000)
  expect(detail.events.map((event) => event.kind)).toEqual([
    "cooking",
    "served",
    "cash_received",
  ])
  expect(await staff.query(api.orders.queue, { storeId })).toHaveLength(0)
  expect(
    await t.query(api.guestOrders.track, { token: input.token })
  ).toMatchObject({ paid: true, order: { status: "served" } })
})

test("table corrections before collection preserve the bill and preparation history, with one audited change per destination", async () => {
  const { t, owner, staff, storeId, tableId, input, command } = await cafe()
  const nextTable = await owner.mutation(api.tables.add, { storeId, number: 7 })
  const before = await staff.query(api.orders.detail, command)
  const correction = {
    ...command,
    destination: { kind: "table" as const, tableId: nextTable },
  }
  await Promise.all([
    staff.mutation(api.orders.assignDestination, correction),
    owner.mutation(api.orders.assignDestination, correction),
  ])
  const corrected = await staff.query(api.orders.detail, command)
  expect(corrected.order).toMatchObject({
    lines: before.order.lines,
    total: 5000,
    status: "pending",
    note: input.note,
    destination: { kind: "table", number: 7 },
  })
  expect(corrected.payment).toBeNull()
  expect(corrected.events).toMatchObject([
    {
      kind: "destination_changed",
      previousDestination: { kind: "table", tableId, number: 4 },
      destination: { kind: "table", tableId: nextTable, number: 7 },
      actorId: expect.any(String),
      actorName: expect.any(String),
    },
  ])
  expect(
    await t.query(api.guestOrders.track, { token: input.token })
  ).toMatchObject({
    paid: false,
    order: { destination: { kind: "table", number: 7 } },
  })
  await expect(
    staff.mutation(api.orders.assignDestination, {
      ...command,
      destination: { kind: "takeaway" },
    })
  ).rejects.toThrow("TABLE_REQUIRED")
  await staff.mutation(api.orders.startCooking, command)
  await staff.mutation(api.orders.markServed, command)
  const served = await staff.query(api.orders.detail, command)
  await staff.mutation(api.orders.assignDestination, {
    ...command,
    destination: { kind: "table", tableId },
  })
  const after = await staff.query(api.orders.detail, command)
  expect(after.order).toMatchObject({
    status: "served",
    cookingAt: served.order.cookingAt,
    servedAt: served.order.servedAt,
    lines: served.order.lines,
    total: served.order.total,
    destination: { kind: "table", number: 4 },
  })
  expect(after.events.map((event) => event.kind)).toEqual([
    "destination_changed",
    "cooking",
    "served",
    "destination_changed",
  ])
})

test("alert baselines include seated cash work before collection but exclude counter bills awaiting cash or assignment", async () => {
  const { t, owner, staff, storeId, itemId, orderId, input, command } =
    await cafe()
  const counter = await staff.mutation(api.orders.createCounter, {
    storeId,
    submissionKey: "alert-counter-order",
    lines: [{ itemId, quantity: 1, expectedPrice: 2500 }],
    note: "",
  })
  expect(await staff.mutation(api.orders.soundBaseline, { storeId })).toEqual([
    orderId,
  ])
  await staff.mutation(api.orders.recordCash, { storeId, orderId: counter })
  expect(await staff.mutation(api.orders.soundBaseline, { storeId })).toEqual([
    orderId,
  ])
  await staff.mutation(api.orders.assignDestination, {
    storeId,
    orderId: counter,
    destination: { kind: "takeaway" },
  })
  expect(
    new Set(await staff.mutation(api.orders.soundBaseline, { storeId }))
  ).toEqual(new Set([orderId, counter]))
  await staff.mutation(api.orders.startCooking, command)
  await staff.mutation(api.orders.markServed, command)
  expect(await staff.mutation(api.orders.soundBaseline, { storeId })).toEqual([
    counter,
  ])
  await expect(
    t.mutation(api.orders.soundBaseline, { storeId })
  ).rejects.toThrow("Unauthenticated")
  expect(
    (await t.query(api.guestOrders.track, { token: input.token }))?.paid
  ).toBe(false)
})

test("QR operations require current same-store membership and staff cannot access owner management", async () => {
  const { t, staff, membershipId, storeId, command } = await cafe()
  const other = await authenticate(t, "qr-other-owner@example.com")
  const otherStore = await other.mutation(api.stores.create, {
    name: "Other Cafe",
  })
  const tableId = await other.mutation(api.tables.add, {
    storeId: otherStore,
    number: 7,
  })
  await expect(
    staff.mutation(api.orders.assignDestination, {
      ...command,
      destination: { kind: "table", tableId },
    })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  await expect(
    staff.mutation(api.tables.add, { storeId, number: 9 })
  ).rejects.toThrow("OWNER_REQUIRED")
  await expect(staff.query(api.stores.get, { storeId })).rejects.toThrow(
    "OWNER_REQUIRED"
  )
  await expect(staff.query(api.staff.directory, { storeId })).rejects.toThrow(
    "OWNER_REQUIRED"
  )
  expect(await staff.query(api.stores.workspace)).toMatchObject({
    role: "staff",
    store: { _id: storeId, name: "Seated Cafe" },
    access: null,
  })
  for (const actor of [t, other]) {
    await expect(actor.query(api.orders.queue, { storeId })).rejects.toThrow()
    await expect(actor.query(api.orders.detail, command)).rejects.toThrow()
    await expect(
      actor.mutation(api.orders.soundBaseline, { storeId })
    ).rejects.toThrow()
    await expect(
      actor.mutation(api.orders.recordCash, command)
    ).rejects.toThrow()
    await expect(
      actor.mutation(api.orders.startCooking, command)
    ).rejects.toThrow()
    await expect(
      actor.mutation(api.orders.markServed, command)
    ).rejects.toThrow()
    await expect(
      actor.mutation(api.orders.assignDestination, {
        ...command,
        destination: { kind: "table", tableId },
      })
    ).rejects.toThrow()
  }
  await t.run((ctx) => ctx.db.patch(membershipId, { revokedAt: Date.now() }))
  for (const operation of [
    api.orders.recordCash,
    api.orders.startCooking,
    api.orders.markServed,
  ])
    await expect(staff.mutation(operation, command)).rejects.toThrow(
      "STORE_ACCESS_DENIED"
    )
})

test("serving and cash collection racing preserve both outcomes and clear the outstanding bill", async () => {
  const { t, staff, owner, storeId, input, command } = await cafe()
  await staff.mutation(api.orders.startCooking, command)
  await Promise.all([
    staff.mutation(api.orders.markServed, command),
    owner.mutation(api.orders.recordCash, command),
  ])
  expect(
    await t.query(api.guestOrders.track, { token: input.token })
  ).toMatchObject({ paid: true, order: { status: "served", total: 5000 } })
  expect(await staff.query(api.orders.queue, { storeId })).toEqual([])
  const detail = await staff.query(api.orders.detail, command)
  expect(detail.events.map((event) => event.kind).sort()).toEqual([
    "cash_received",
    "cooking",
    "served",
  ])
})
