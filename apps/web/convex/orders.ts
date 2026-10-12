import { ConvexError, v } from "convex/values"
import { paginationOptsValidator } from "convex/server"
import {
  mutation,
  internalMutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { internal } from "./_generated/api"
import { reportCollection, reportRefund, reportUnpaid } from "./lib/reporting"
import { orderMoney, migrateCash } from "./lib/order_money"
import type { Id } from "./_generated/dataModel"
import {
  assertAcceptingOrders,
  requireStoreMembership,
  requireStoreOwner,
} from "./lib/store_access"
import { destinationInput } from "./lib/order_values"
import { orderLineInput, snapshotOrderLines } from "./lib/order_lines"
import { isReadyToCook } from "../lib/order-readiness"

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
  const order = await ctx.db.get(orderId)
  return order ? (await orderMoney(ctx, order)).payment : null
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
    lines: v.array(orderLineInput),
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
    if (args.submissionKey.length < 8 || args.submissionKey.length > 100)
      throw new ConvexError("INVALID_ORDER")
    const { lines, total } = await snapshotOrderLines(
      ctx,
      args.storeId,
      args.lines,
      args.note
    )
    const orderId = await ctx.db.insert("orders", {
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
    await reportUnpaid(ctx, orderId, total)
    return orderId
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
      await Promise.all([
        ...(["pending", "cooking"] as const).map((status) =>
          ctx.db
            .query("orders")
            .withIndex("by_store_status", (q) =>
              q.eq("storeId", storeId).eq("status", status)
            )
            .collect()
        ),
        ctx.db
          .query("orders")
          .withIndex("by_store_cash_collection", (q) =>
            q.eq("storeId", storeId).eq("cashCollectionPending", true)
          )
          .collect(),
      ])
    )
      .flat()
      .sort((a, b) => a.createdAt - b.createdAt)
    const queue = await Promise.all(
      orders.map(async (order) => ({
        ...order,
        ...(await orderMoney(ctx, order)),
      }))
    )
    return queue.filter((order) => order.status !== "served" || !order.payment)
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
        isReadyToCook(
          order,
          order.source === "counter" && !!(await paymentFor(ctx, order._id))
        )
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
      ...(await orderMoney(ctx, order)),
      events: await ctx.db
        .query("orderEvents")
        .withIndex("by_order", (q) => q.eq("orderId", orderId))
        .collect(),
    }
  },
})
export const history = query({
  args: {
    storeId: v.id("stores"),
    status: v.optional(v.union(v.literal("served"), v.literal("cancelled"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { storeId, status, paginationOpts }) => {
    await requireStoreMembership(ctx, storeId)
    // An indexed legacy probe keeps All History available throughout backfill.
    const legacy =
      !status &&
      (await ctx.db
        .query("orders")
        .withIndex("by_store_status_terminal", (q) =>
          q
            .eq("storeId", storeId)
            .eq("status", "served")
            .eq("terminal", undefined)
        )
        .first())
    const readerHint = paginationOpts.cursor ?? paginationOpts.endCursor
    const compatibility =
      readerHint?.startsWith("legacy|") || (!readerHint && !!legacy)
    const cursorMode = status ?? (compatibility ? "legacy" : "terminal")
    const unwrap = (value: string | null | undefined) =>
      value?.startsWith(`${cursorMode}|`)
        ? value.slice(cursorMode.length + 1)
        : value
    const cursor = unwrap(paginationOpts.cursor) ?? null
    const endCursor = unwrap(paginationOpts.endCursor)
    const history = status
      ? ctx.db
          .query("orders")
          .withIndex("by_store_status", (q) =>
            q.eq("storeId", storeId).eq("status", status)
          )
      : compatibility
        ? ctx.db
            .query("orders")
            .withIndex("by_store_created", (q) => q.eq("storeId", storeId))
            .filter((q) =>
              q.or(
                q.eq(q.field("status"), "served"),
                q.eq(q.field("status"), "cancelled")
              )
            )
        : ctx.db
            .query("orders")
            .withIndex("by_store_terminal", (q) =>
              q.eq("storeId", storeId).eq("terminal", true)
            )
    const result = await history
      .order("desc")
      .paginate({ ...paginationOpts, cursor, endCursor })
    return {
      ...result,
      // Preserve each paginator's index across the upgrade, including split cursors.
      continueCursor: `${cursorMode}|${result.continueCursor}`,
      ...(result.splitCursor
        ? { splitCursor: `${cursorMode}|${result.splitCursor}` }
        : {}),
      page: await Promise.all(
        result.page.map(async (order) => ({
          ...order,
          ...(await orderMoney(ctx, order)),
        }))
      ),
    }
  },
})
export const recordCash = mutation({
  args: command,
  handler: async (ctx, { storeId, orderId }) => {
    const { order, user } = await accessOrder(ctx, storeId, orderId)
    if (order.status === "cancelled") throw new ConvexError("ORDER_CANCELLED")
    if (await paymentFor(ctx, orderId)) return
    const at = Date.now()
    const collectionId = await ctx.db.insert("orderCollections", {
      storeId,
      orderId,
      amount: order.total,
      currency: "MMK",
      method: "cash",
      reference: `cash:${orderId}`,
      collectedAt: at,
      timeSource: "cash_recorded",
      recordedAt: at,
      recordedBy: user._id,
    })
    await reportCollection(ctx, collectionId)
    await reportUnpaid(ctx, orderId, 0)
    await ctx.db.patch(orderId, { cashCollectionPending: false })
    await event(ctx, storeId, orderId, user._id, user.name, "cash_received")
  },
})
export const assignDestination = mutation({
  args: { ...command, destination: destinationInput },
  handler: async (ctx, { storeId, orderId, destination: input }) => {
    const { order, user } = await accessOrder(ctx, storeId, orderId)
    if (order.status === "cancelled") throw new ConvexError("ORDER_CANCELLED")
    if (order.source === "counter" && !(await paymentFor(ctx, orderId)))
      throw new ConvexError("PAYMENT_REQUIRED")
    if (order.source === "qr" && input.kind !== "table")
      throw new ConvexError("TABLE_REQUIRED")
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
    if (
      order.destination?.kind === next.kind &&
      (next.kind === "takeaway" ||
        (order.destination.kind === "table" &&
          order.destination.tableId === next.tableId))
    )
      return
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
    if (order.status === "cancelled") throw new ConvexError("ORDER_CANCELLED")
    if (order.status !== "pending") return
    if (order.source === "counter" && !(await paymentFor(ctx, orderId)))
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
    if (order.status === "cancelled") throw new ConvexError("ORDER_CANCELLED")
    if (order.status === "served") return
    if (order.status !== "cooking") throw new ConvexError("ORDER_NOT_COOKING")
    await ctx.db.patch(orderId, {
      status: "served",
      terminal: true,
      servedAt: Date.now(),
      cashCollectionPending: !(await paymentFor(ctx, orderId)),
    })
    await event(ctx, storeId, orderId, user._id, user.name, "served")
  },
})

export const cancel = mutation({
  args: { ...command, requestKey: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireStoreOwner(ctx, args.storeId)
    const { order } = await accessOrder(ctx, args.storeId, args.orderId)
    const previous = await ctx.db
      .query("orders")
      .withIndex("by_cancel_request", (q) =>
        q
          .eq("storeId", args.storeId)
          .eq("cancellation.requestKey", args.requestKey)
      )
      .unique()
    if (previous) {
      if (
        previous._id !== args.orderId ||
        previous.cancellation?.reason !== args.reason
      )
        throw new ConvexError("COMMAND_KEY_REUSED")
      return previous._id
    }
    if (order.status !== "pending" && order.status !== "cooking")
      throw new ConvexError("ORDER_NOT_CANCELLABLE")
    if (
      !args.reason.trim() ||
      args.reason.length > 2000 ||
      args.requestKey.length < 8 ||
      args.requestKey.length > 100
    )
      throw new ConvexError("INVALID_CANCELLATION")
    const at = Date.now()
    await ctx.db.patch(order._id, {
      status: "cancelled",
      terminal: true,
      cashCollectionPending: false,
      cancellation: {
        reason: args.reason,
        requestKey: args.requestKey,
        actorId: user._id,
        actorName: user.name,
        at,
      },
    })
    await reportUnpaid(ctx, order._id, 0)
    await ctx.db.insert("orderEvents", {
      storeId: args.storeId,
      orderId: order._id,
      actorId: user._id,
      actorName: user.name,
      at,
      kind: "cancelled",
      reason: args.reason,
    })
    return order._id
  },
})

export const recordRefund = mutation({
  args: {
    ...command,
    collectionId: v.union(v.id("orderCollections"), v.id("cashPayments")),
    requestKey: v.string(),
    reason: v.string(),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireStoreOwner(ctx, args.storeId)
    const { order } = await accessOrder(ctx, args.storeId, args.orderId)
    const payload = JSON.stringify({
      orderId: args.orderId,
      collectionId: args.collectionId,
      reason: args.reason,
      completedAt: args.completedAt ?? null,
    })
    const previous = await ctx.db
      .query("orderRefunds")
      .withIndex("by_request", (q) =>
        q.eq("storeId", args.storeId).eq("requestKey", args.requestKey)
      )
      .unique()
    if (previous) {
      if (previous.payload !== payload)
        throw new ConvexError("COMMAND_KEY_REUSED")
      return previous._id
    }
    if (
      !args.reason.trim() ||
      args.reason.length > 2000 ||
      args.requestKey.length < 8 ||
      args.requestKey.length > 100
    )
      throw new ConvexError("INVALID_REFUND")
    const supplied = await ctx.db.get(args.collectionId)
    if (
      !supplied ||
      supplied.storeId !== args.storeId ||
      supplied.orderId !== order._id
    )
      throw new ConvexError("INVALID_COLLECTION")
    const collectionId =
      "receivedAt" in supplied ? await migrateCash(ctx, supplied) : supplied._id
    const collection = await ctx.db.get(collectionId)
    if (!collection) throw new ConvexError("INVALID_COLLECTION")
    const duplicate = await ctx.db
      .query("orderRefunds")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .unique()
    if (duplicate) throw new ConvexError("ALREADY_REFUNDED")
    const at = Date.now()
    const completedAt = args.completedAt ?? at
    if (
      !Number.isSafeInteger(completedAt) ||
      completedAt < 0 ||
      completedAt > at ||
      (collection.timeSource !== "verification_fallback" &&
        completedAt < collection.collectedAt)
    )
      throw new ConvexError("INVALID_REFUND_DATE")
    const money = await orderMoney(ctx, order)
    if (
      (order.status === "pending" || order.status === "cooking") &&
      money.money.retained - collection.amount < order.total
    )
      throw new ConvexError("CANCEL_BEFORE_REFUND")
    const refundId = await ctx.db.insert("orderRefunds", {
      storeId: args.storeId,
      orderId: order._id,
      collectionId,
      amount: collection.amount,
      method: collection.method,
      reference: collection.reference,
      currency: collection.currency,
      collectedAt: collection.collectedAt,
      collectionTimeSource: collection.timeSource,
      completedAt,
      recordedAt: at,
      actorId: user._id,
      actorName: user.name,
      reason: args.reason,
      uncertainChronology: completedAt < collection.collectedAt,
      requestKey: args.requestKey,
      payload,
    })
    await reportCollection(ctx, collectionId)
    await reportRefund(ctx, refundId)
    await reportUnpaid(ctx, order._id, 0)
    await ctx.db.insert("orderEvents", {
      storeId: args.storeId,
      orderId: order._id,
      actorId: user._id,
      actorName: user.name,
      at,
      kind: "refund_recorded",
      refundId,
    })
    return refundId
  },
})

// Bounded, restartable upgrade. CLI invocation is internal; no browser migration endpoint.
export const migrateRecords = internalMutation({
  args: {
    phase: v.union(v.literal("cash"), v.literal("orders")),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { phase, cursor }) => {
    const page =
      phase === "cash"
        ? await ctx.db
            .query("cashPayments")
            .paginate({ cursor: cursor ?? null, numItems: 100 })
        : await ctx.db
            .query("orders")
            .paginate({ cursor: cursor ?? null, numItems: 100 })
    for (const record of page.page) {
      if ("receivedAt" in record) await migrateCash(ctx, record)
      else
        await ctx.db.patch(record._id, {
          terminal: record.status === "served" || record.status === "cancelled",
        })
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.orders.migrateRecords, {
        phase,
        cursor: page.continueCursor,
      })
    else if (phase === "cash")
      await ctx.scheduler.runAfter(0, internal.orders.migrateRecords, {
        phase: "orders",
      })
    return { isDone: page.isDone, nextCursor: page.continueCursor }
  },
})
