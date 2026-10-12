import type { Doc } from "../convex/_generated/dataModel"

export function isReadyToCook(
  order: Pick<
    Doc<"orders">,
    "source" | "status" | "destination" | "paymentMethod"
  >,
  paid: boolean
) {
  return (
    order.status === "pending" &&
    !!order.destination &&
    ((order.source === "qr" && order.paymentMethod !== "mmqr") || paid)
  )
}
