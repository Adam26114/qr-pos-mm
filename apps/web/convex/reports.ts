import { v } from "convex/values"
import { paginationOptsValidator } from "convex/server"
import { internalMutation, query, type QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"
import { syncPaymentReview } from "./lib/payment_review"
import { migrateCash, orderMoney } from "./lib/order_money"
import {
  reportCollection,
  reportRefund,
  reportState,
  reportUnpaid,
} from "./lib/reporting"
import { requireStoreOwner } from "./lib/store_access"
import { reportPeriod, yangonDay } from "./lib/report_period"

const periodArgs = {
  storeId: v.id("stores"),
  kind: v.union(v.literal("day"), v.literal("month")),
  key: v.string(),
}

export const dates = query({
  args: { storeId: v.id("stores"), refresh: v.string() },
  handler: async (ctx, { storeId }) => {
    await requireStoreOwner(ctx, storeId)
    const now = Date.now()
    const day = yangonDay(now)
    return {
      now,
      day,
      month: day.slice(0, 7),
      nextMidnight: reportPeriod("day", day).end,
    }
  },
})

export const unpaid = query({
  args: { storeId: v.id("stores"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { storeId, paginationOpts }) => {
    await requireStoreOwner(ctx, storeId)
    if (!(await ready(ctx, storeId))) return preparingPage
    const result = await ctx.db
      .query("orders")
      .withIndex("by_store_outstanding", (q) =>
        q.eq("storeId", storeId).eq("outstanding", true)
      )
      .order("asc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(paginationOpts.numItems, 100),
      })
    return {
      ...result,
      ready: true as const,
      page: result.page.map((order) => ({
        ...bill(order),
        due: order.reportingDue ?? 0,
      })),
    }
  },
})

async function ready(ctx: QueryCtx, storeId: Id<"stores">) {
  return !!(
    await ctx.db
      .query("reportStates")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .unique()
  )?.ready
}
const preparingPage = {
  ready: false as const,
  page: [] as never[],
  isDone: true,
  continueCursor: "",
}

function bill(order: Doc<"orders">) {
  return {
    _id: order._id,
    createdAt: order.createdAt,
    destination: order.destination,
    source: order.source,
    status: order.status,
    total: order.total,
  }
}

async function financialRow(
  ctx: QueryCtx,
  record: Doc<"orderCollections"> | Doc<"orderRefunds">
) {
  const order = await ctx.db.get(record.orderId)
  if (!order || order.storeId !== record.storeId)
    throw new Error("Invalid financial order reference")
  return {
    _id: record._id,
    eventAt: "completedAt" in record ? record.completedAt : record.collectedAt,
    recordedAt: record.recordedAt,
    method: record.method,
    simulated: record.simulated ?? false,
    reference: record.reference,
    amount: record.amount,
    order: bill(order),
  }
}

const detailArgs = { ...periodArgs, paginationOpts: paginationOptsValidator }

export const collections = query({
  args: detailArgs,
  handler: async (ctx, { storeId, kind, key, paginationOpts }) => {
    await requireStoreOwner(ctx, storeId)
    const period = reportPeriod(kind, key)
    if (!(await ready(ctx, storeId))) return preparingPage
    const result = await ctx.db
      .query("orderCollections")
      .withIndex("by_store_collected", (q) =>
        q
          .eq("storeId", storeId)
          .gte("collectedAt", period.start)
          .lt("collectedAt", period.end)
      )
      .order("desc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(paginationOpts.numItems, 100),
      })
    return {
      ...result,
      ready: true as const,
      page: await Promise.all(result.page.map((row) => financialRow(ctx, row))),
    }
  },
})

export const refunds = query({
  args: detailArgs,
  handler: async (ctx, { storeId, kind, key, paginationOpts }) => {
    await requireStoreOwner(ctx, storeId)
    const period = reportPeriod(kind, key)
    if (!(await ready(ctx, storeId))) return preparingPage
    const result = await ctx.db
      .query("orderRefunds")
      .withIndex("by_store_completed", (q) =>
        q
          .eq("storeId", storeId)
          .gte("completedAt", period.start)
          .lt("completedAt", period.end)
      )
      .order("desc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(paginationOpts.numItems, 100),
      })
    return {
      ...result,
      ready: true as const,
      page: await Promise.all(result.page.map((row) => financialRow(ctx, row))),
    }
  },
})

export const summary = query({
  args: periodArgs,
  handler: async (ctx, { storeId, kind, key }) => {
    await requireStoreOwner(ctx, storeId)
    const period = reportPeriod(kind, key)
    const state = await ctx.db
      .query("reportStates")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .unique()
    if (!state?.ready) return { ready: false as const, period }
    const days = await ctx.db
      .query("reportDays")
      .withIndex("by_store_day", (q) =>
        q
          .eq("storeId", storeId)
          .gte("day", period.firstDay)
          .lt("day", period.endDay)
      )
      .collect()
    const collected = days.reduce((sum, day) => sum + day.collected, 0)
    const refunded = days.reduce((sum, day) => sum + day.refunded, 0)
    return {
      ready: true as const,
      period,
      collected,
      refunded,
      net: collected - refunded,
      unpaidAmount: state.unpaidAmount,
      unpaidCount: state.unpaidCount,
    }
  },
})

export const backfill = internalMutation({
  args: {
    storeId: v.id("stores"),
    phase: v.optional(
      v.union(
        v.literal("cash"),
        v.literal("collections"),
        v.literal("refunds"),
        v.literal("orders")
      )
    ),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { storeId, phase = "cash", cursor }
  ): Promise<{ isDone: boolean; nextCursor: string }> => {
    const state = await reportState(ctx, storeId)
    if (phase === "cash" && !cursor)
      await ctx.db.patch(state._id, { ready: false, paymentReviewReady: false })
    const options = { cursor: cursor ?? null, numItems: 100 }
    const page =
      phase === "cash"
        ? await ctx.db
            .query("cashPayments")
            .withIndex("by_store_received", (q) => q.eq("storeId", storeId))
            .paginate(options)
        : phase === "collections"
          ? await ctx.db
              .query("orderCollections")
              .withIndex("by_store_collected", (q) => q.eq("storeId", storeId))
              .paginate(options)
          : phase === "refunds"
            ? await ctx.db
                .query("orderRefunds")
                .withIndex("by_store_completed", (q) =>
                  q.eq("storeId", storeId)
                )
                .paginate(options)
            : await ctx.db
                .query("orders")
                .withIndex("by_store_created", (q) => q.eq("storeId", storeId))
                .paginate(options)
    for (const record of page.page) {
      if ("receivedAt" in record) await migrateCash(ctx, record)
      else if ("completedAt" in record) await reportRefund(ctx, record._id)
      else if ("collectedAt" in record) await reportCollection(ctx, record._id)
      else {
        await syncPaymentReview(ctx, record._id)
        await reportUnpaid(
          ctx,
          record._id,
          (await orderMoney(ctx, record)).money.due
        )
      }
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.reports.backfill, {
        storeId,
        phase,
        cursor: page.continueCursor,
      })
    else if (phase !== "orders") {
      const next =
        phase === "cash"
          ? "collections"
          : phase === "collections"
            ? "refunds"
            : "orders"
      await ctx.scheduler.runAfter(0, internal.reports.backfill, {
        storeId,
        phase: next,
      })
    } else
      await ctx.db.patch(state._id, { ready: true, paymentReviewReady: true })
    return { isDone: page.isDone, nextCursor: page.continueCursor }
  },
})

export const backfillAll = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (
    ctx,
    { cursor }
  ): Promise<{ isDone: boolean; nextCursor: string }> => {
    const stores = await ctx.db
      .query("stores")
      .paginate({ cursor: cursor ?? null, numItems: 25 })
    for (const store of stores.page)
      await ctx.scheduler.runAfter(0, internal.reports.backfill, {
        storeId: store._id,
      })
    if (!stores.isDone)
      await ctx.scheduler.runAfter(0, internal.reports.backfillAll, {
        cursor: stores.continueCursor,
      })
    return { isDone: stores.isDone, nextCursor: stores.continueCursor }
  },
})
