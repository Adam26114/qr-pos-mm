import type { Doc } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"

function legacyCollection(payment: Doc<"cashPayments">) {
  return {
    ...payment,
    currency: "MMK" as const,
    method: "cash" as const,
    reference: `cash:${payment.orderId}`,
    collectedAt: payment.receivedAt,
    timeSource: "cash_recorded" as const,
    recordedAt: payment.receivedAt,
  }
}

// Legacy receipts are read only. A migrated receipt and its source count once.
export async function orderMoney(ctx: QueryCtx, order: Doc<"orders">) {
  const collections = await ctx.db
    .query("orderCollections")
    .withIndex("by_order", (q) => q.eq("orderId", order._id))
    .collect()
  const legacy = await ctx.db
    .query("cashPayments")
    .withIndex("by_order", (q) => q.eq("orderId", order._id))
    .unique()
  const all =
    legacy && !collections.some((c) => c.legacyCashPaymentId === legacy._id)
      ? [...collections, legacyCollection(legacy)]
      : collections
  const refunds = await ctx.db
    .query("orderRefunds")
    .withIndex("by_order", (q) => q.eq("orderId", order._id))
    .collect()
  const collected = all.reduce((sum, payment) => sum + payment.amount, 0)
  const refunded = refunds.reduce((sum, refund) => sum + refund.amount, 0)
  const retained = collected - refunded
  const payment = all[0] ? { ...all[0], receivedAt: all[0].collectedAt } : null
  return {
    collections: all,
    refunds,
    payment,
    money: {
      collected,
      refunded,
      retained,
      funded: retained >= order.total,
      due:
        order.status === "cancelled" || refunds.length
          ? 0
          : Math.max(0, order.total - retained),
    },
  }
}

export async function migrateCash(
  ctx: MutationCtx,
  payment: Doc<"cashPayments">
) {
  const existing = await ctx.db
    .query("orderCollections")
    .withIndex("by_legacy_cash", (q) =>
      q.eq("legacyCashPaymentId", payment._id)
    )
    .unique()
  if (existing) return existing._id
  const { _id, _creationTime, receivedAt, ...fields } =
    legacyCollection(payment)
  return ctx.db.insert("orderCollections", {
    ...fields,
    legacyCashPaymentId: _id,
  })
}
