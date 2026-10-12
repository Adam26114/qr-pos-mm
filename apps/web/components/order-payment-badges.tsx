"use client"

import { Badge } from "@workspace/ui/components/badge"
import { usePosCopy } from "@/lib/pos-copy"
import { usePaymentCopy } from "@/lib/payment-copy"
import { formatMMK } from "@/lib/menu"

export function OrderPaymentBadges({
  paid,
  refunded,
  cashOnly,
  cancelled,
  simulated = false,
}: {
  paid: boolean
  refunded: number
  cashOnly: boolean
  simulated?: boolean
  cancelled: boolean
}) {
  const pos = usePosCopy()
  const paymentText = usePaymentCopy()
  return (
    <>
      {simulated && (
        <Badge variant="outline" className="h-auto whitespace-normal">
          {paymentText.simulation}
        </Badge>
      )}
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
