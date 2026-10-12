type RefundableOrder = {
  status: "pending" | "cooking" | "served" | "cancelled"
  total: number
  money: { retained: number; refunded: number }
  collections: { _id: string; amount: number }[]
  refunds: { collectionId: string }[]
}

// Presentation only. The mutation independently enforces funding and authorization.
export function eligibleRefunds<T extends RefundableOrder>(
  order: T
): T["collections"] {
  if (!order.collections || !order.refunds || !order.money) return []
  return order.collections.filter(
    (collection) =>
      !order.refunds.some((refund) => refund.collectionId === collection._id) &&
      ((order.status !== "pending" && order.status !== "cooking") ||
        order.money.retained - collection.amount >= order.total)
  )
}

// A hosted deployment can briefly serve the previous projection while frontend code refreshes.
export function financialSnapshot<
  T extends RefundableOrder & { payment: { amount: number } | null },
>(order: T) {
  return {
    ...order,
    collections: order.collections ?? [],
    refunds: order.refunds ?? [],
    money: order.money ?? {
      collected: order.payment?.amount ?? 0,
      refunded: 0,
      retained: order.payment?.amount ?? 0,
      due: order.status === "cancelled" || order.payment ? 0 : order.total,
      funded: !!order.payment,
    },
  }
}
