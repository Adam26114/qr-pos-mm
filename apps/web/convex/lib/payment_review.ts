import type { MutationCtx } from "../_generated/server"
import type { Id } from "../_generated/dataModel"
import { orderMoney } from "./order_money"
import { reportState } from "./reporting"

// Each order contributes once; retries, concurrent writes and restartable backfill share this marker.
export async function syncPaymentReview(
  ctx: MutationCtx,
  orderId: Id<"orders">
) {
  const order = await ctx.db.get(orderId)
  if (!order) return
  const { money } = await orderMoney(ctx, order)
  const required =
    money.retained > order.total ||
    (order.status === "cancelled" && money.retained > 0)
  const state = await reportState(ctx, order.storeId)
  await ctx.db.patch(state._id, {
    paymentReviewCount:
      (state.paymentReviewCount ?? 0) +
      Number(required) -
      Number(order.paymentReviewRequired ?? false),
  })
  await ctx.db.patch(orderId, { paymentReviewRequired: required })
}
