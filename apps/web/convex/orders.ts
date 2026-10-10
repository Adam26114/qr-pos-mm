import { ConvexError, v } from "convex/values"
import { paginationOptsValidator } from "convex/server"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import {
  assertAcceptingOrders,
  requireStoreMembership,
} from "./lib/store_access"
import { destinationInput } from "./lib/order_values"

const command = { storeId: v.id("stores"), orderId: v.id("orders") }
async function accessOrder(
  ctx: QueryCtx,
  storeId: Id<"stores">,
  orderId: Id<"orders">
) {
  const { user } = await requireStoreMembership(ctx, storeId)
  const order = await ctx.db.get(orderId)
  if (!order || order.storeId !== storeId)
    throw new ConvexError("STORE_ACCESS_DENIED")
  return { order, user }
}
async function paymentFor(ctx: QueryCtx, orderId: Id<"orders">) {
  return await ctx.db
    .query("cashPayments")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .unique()
}
async function event(
  ctx: MutationCtx,
  storeId: Id<"stores">,
  orderId: Id<"orders">,
  actorId: string,
  actorName: string,
  kind: "cash_received" | "cooking" | "served"
) {
  await ctx.db.insert("orderEvents", {
    storeId,
    orderId,
    actorId,
    actorName,
    kind,
    at: Date.now(),
  })
}
export const createCounter = mutation({
  args: {
    storeId: v.id("stores"),
    submissionKey: v.string(),
    lines: v.array(
      v.object({
        itemId: v.id("menuItems"),
        quantity: v.number(),
        expectedPrice: v.number(),
      })
    ),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, store } = await requireStoreMembership(ctx, args.storeId)
    const payload = JSON.stringify({
      lines: [...args.lines].sort((a, b) => a.itemId.localeCompare(b.itemId)),
      note: args.note,
    })
    const accepted = await ctx.db
      .query("orders")
      .withIndex("by_submission", (q) =>
        q
          .eq("storeId", args.storeId)
          .eq("createdBy", user._id)
          .eq("submissionKey", args.submissionKey)
      )
      .unique()
    if (accepted) {
      if (accepted.payload !== payload)
        throw new ConvexError("SUBMISSION_KEY_REUSED")
      return accepted._id
    }
    assertAcceptingOrders(store)
    if (
      !args.lines.length ||
      args.lines.length > 100 ||
      args.note.length > 2000 ||
      args.submissionKey.length < 8 ||
      args.submissionKey.length > 100
    )
      throw new ConvexError("INVALID_ORDER")
    const ids = new Set<string>()
    const lines = []
    let total = 0
    for (const line of args.lines) {
      if (
        ids.has(line.itemId) ||
        !Number.isSafeInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > 99
      )
        throw new ConvexError("INVALID_ORDER")
      ids.add(line.itemId)
      const item = await ctx.db.get(line.itemId)
      if (!item || item.storeId !== args.storeId)
        throw new ConvexError("STORE_ACCESS_DENIED")
      const category = await ctx.db.get(item.categoryId)
      if (
        item.removedAt !== undefined ||
        !item.available ||
        !category ||
        category.removedAt !== undefined
      )
        throw new ConvexError("ITEM_UNAVAILABLE")
      if (item.price !== line.expectedPrice)
        throw new ConvexError("PRICE_CHANGED")
      total += item.price * line.quantity
      if (!Number.isSafeInteger(total) || total < 1)
        throw new ConvexError("INVALID_ORDER")
      lines.push({
        itemId: item._id,
        name: item.name,
        unitPrice: item.price,
        quantity: line.quantity,
      })
    }
    return await ctx.db.insert("orders", {
      storeId: args.storeId,
      createdBy: user._id,
      submissionKey: args.submissionKey,
      payload,
      createdAt: Date.now(),
      source: "counter",
      lines,
      note: args.note,
      total,
      status: "pending",
      destination: null,
    })
  },
})
export const submission = query({
  args: { storeId: v.id("stores"), submissionKey: v.string() },
  handler: async (ctx, { storeId, submissionKey }) => {
    const { user } = await requireStoreMembership(ctx, storeId)
    const order = await ctx.db
      .query("orders")
      .withIndex("by_submission", (q) =>
        q
          .eq("storeId", storeId)
          .eq("createdBy", user._id)
          .eq("submissionKey", submissionKey)
      )
      .unique()
    return order?._id ?? null
  },
})
export const queue = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, { storeId }) => {
    await requireStoreMembership(ctx, storeId)
    const orders = (
      await Promise.all(
        (["pending", "cooking"] as const).map((status) =>
          ctx.db
            .query("orders")
            .withIndex("by_store_status", (q) =>
              q.eq("storeId", storeId).eq("status", status)
            )
            .collect()
        )
      )
    )
      .flat()
      .sort((a, b) => a.createdAt - b.createdAt)
    return await Promise.all(
      orders.map(async (order) => ({
        ...order,
        payment: await paymentFor(ctx, order._id),
      }))
    )
  },
})
// A mutation response confirms a current server snapshot, unlike a cached subscription on reconnect.
export const soundBaseline = mutation({
  args: { storeId: v.id("stores") },
  handler: async (ctx, { storeId }) => {
    await requireStoreMembership(ctx, storeId)
    const pending = await ctx.db
      .query("orders")
      .withIndex("by_store_status", (q) =>
        q.eq("storeId", storeId).eq("status", "pending")
      )
      .collect()
    const ready = await Promise.all(
      pending.map(async (order) =>
        order.destination && (await paymentFor(ctx, order._id))
          ? order._id
          : null
      )
    )
    return ready.filter((id): id is Id<"orders"> => id !== null)
  },
})
export const detail = query({
  args: command,
  handler: async (ctx, { storeId, orderId }) => {
    const { order } = await accessOrder(ctx, storeId, orderId)
    return {
      order,
      payment: await paymentFor(ctx, orderId),
      events: await ctx.db
        .query("orderEvents")
        .withIndex("by_order", (q) => q.eq("orderId", orderId))
        .collect(),
    }
  },
})
export const history = query({
  args: { storeId: v.id("stores"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { storeId, paginationOpts }) => {
    await requireStoreMembership(ctx, storeId)
    const result = await ctx.db
      .query("orders")
      .withIndex("by_store_status", (q) =>
        q.eq("storeId", storeId).eq("status", "served")
      )
      .order("desc")
      .paginate(paginationOpts)
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (order) => ({
          ...order,
          payment: await paymentFor(ctx, order._id),
        }))
      ),
    }
  },
})
export const recordCash = mutation({
  args: command,
  handler: async (ctx, { storeId, orderId }) => {
    const { order, user } = await accessOrder(ctx, storeId, orderId)
    if (await paymentFor(ctx, orderId)) return
    await ctx.db.insert("cashPayments", {
      storeId,
      orderId,
      amount: order.total,
      receivedAt: Date.now(),
      recordedBy: user._id,
    })
    await event(ctx, storeId, orderId, user._id, user.name, "cash_received")
  },
})
export const assignDestination = mutation({
  args: { ...command, destination: destinationInput },
  handler: async (ctx, { storeId, orderId, destination: input }) => {
    const { order, user } = await accessOrder(ctx, storeId, orderId)
    if (!(await paymentFor(ctx, orderId)))
      throw new ConvexError("PAYMENT_REQUIRED")
    let next
    if (input.kind === "table") {
      const table = await ctx.db.get(input.tableId)
      if (!table || table.storeId !== storeId)
        throw new ConvexError("STORE_ACCESS_DENIED")
      if (table.removedAt !== undefined) throw new ConvexError("TABLE_REMOVED")
      next = {
        kind: "table" as const,
        tableId: table._id,
        number: table.number,
      }
    } else next = { kind: "takeaway" as const }
    if (JSON.stringify(order.destination) === JSON.stringify(next)) return
    await ctx.db.patch(orderId, { destination: next })
    await ctx.db.insert("orderEvents", {
      storeId,
      orderId,
      actorId: user._id,
      actorName: user.name,
      at: Date.now(),
      kind: "destination_changed",
      previousDestination: order.destination,
      destination: next,
    })
  },
})
export const startCooking = mutation({
  args: command,
  handler: async (ctx, { storeId, orderId }) => {
    const { order, user } = await accessOrder(ctx, storeId, orderId)
    if (order.status !== "pending") return
    if (!(await paymentFor(ctx, orderId)))
      throw new ConvexError("PAYMENT_REQUIRED")
    if (!order.destination) throw new ConvexError("DESTINATION_REQUIRED")
    await ctx.db.patch(orderId, { status: "cooking", cookingAt: Date.now() })
    await event(ctx, storeId, orderId, user._id, user.name, "cooking")
  },
})
export const markServed = mutation({
  args: command,
  handler: async (ctx, { storeId, orderId }) => {
    const { order, user } = await accessOrder(ctx, storeId, orderId)
    if (order.status === "served") return
    if (order.status !== "cooking") throw new ConvexError("ORDER_NOT_COOKING")
    await ctx.db.patch(orderId, { status: "served", servedAt: Date.now() })
    await event(ctx, storeId, orderId, user._id, user.name, "served")
  },
})
