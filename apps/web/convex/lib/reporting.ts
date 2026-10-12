import type { MutationCtx } from "../_generated/server"
import type { Id } from "../_generated/dataModel"
import { yangonDay } from "./report_period"

export async function reportState(
  ctx: MutationCtx,
  storeId: Id<"stores">,
  ready = false
) {
  const state = await ctx.db
    .query("reportStates")
    .withIndex("by_store", (q) => q.eq("storeId", storeId))
    .unique()
  if (state) return state
  const id = await ctx.db.insert("reportStates", {
    storeId,
    ready,
    unpaidAmount: 0,
    unpaidCount: 0,
  })
  return (await ctx.db.get(id))!
}

async function addDay(
  ctx: MutationCtx,
  storeId: Id<"stores">,
  at: number,
  field: "collected" | "refunded",
  amount: number
) {
  const day = yangonDay(at)
  const bucket = await ctx.db
    .query("reportDays")
    .withIndex("by_store_day", (q) => q.eq("storeId", storeId).eq("day", day))
    .unique()
  if (bucket)
    await ctx.db.patch(bucket._id, { [field]: bucket[field] + amount })
  else
    await ctx.db.insert("reportDays", {
      storeId,
      day,
      collected: field === "collected" ? amount : 0,
      refunded: field === "refunded" ? amount : 0,
    })
}

export async function reportCollection(
  ctx: MutationCtx,
  id: Id<"orderCollections">
) {
  const collection = await ctx.db.get(id)
  if (!collection || collection.reportingApplied) return
  await addDay(
    ctx,
    collection.storeId,
    collection.collectedAt,
    "collected",
    collection.amount
  )
  await ctx.db.patch(id, { reportingApplied: true })
}

export async function reportRefund(ctx: MutationCtx, id: Id<"orderRefunds">) {
  const refund = await ctx.db.get(id)
  if (!refund || refund.reportingApplied) return
  await addDay(
    ctx,
    refund.storeId,
    refund.completedAt,
    "refunded",
    refund.amount
  )
  await ctx.db.patch(id, { reportingApplied: true })
}

// Each order contributes its current due once, even if backfill and live writes interleave.
export async function reportUnpaid(
  ctx: MutationCtx,
  id: Id<"orders">,
  due: number
) {
  const order = await ctx.db.get(id)
  if (!order) return
  const previous = order.reportingDue ?? 0
  const state = await reportState(ctx, order.storeId)
  await ctx.db.patch(state._id, {
    unpaidAmount: state.unpaidAmount + due - previous,
    unpaidCount: state.unpaidCount + Number(due > 0) - Number(previous > 0),
  })
  await ctx.db.patch(id, { reportingDue: due, outstanding: due > 0 })
}
