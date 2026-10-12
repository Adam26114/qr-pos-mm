"use client"

import { Badge } from "@workspace/ui/components/badge"
import { usePosCopy } from "@/lib/pos-copy"
import { formatMMK } from "@/lib/menu"

export function OrderPaymentBadges({
  paid,
  refunded,
  cashOnly,
  cancelled,
}: {
  paid: boolean
  refunded: number
  cashOnly: boolean
  cancelled: boolean
}) {
  const pos = usePosCopy()
  return (
    <>
      <Badge variant={paid ? "secondary" : "outline"}>
        {paid
          ? cashOnly
            ? pos.cashReceived
            : pos.collected
          : cancelled
            ? pos.notCollected
            : pos.unpaid}
      </Badge>
      {refunded > 0 && (
        <Badge variant="outline">
          {pos.refunded} · {formatMMK(refunded)}
        </Badge>
      )}
    </>
  )
}
