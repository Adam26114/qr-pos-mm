"use client"
import { Badge } from "@workspace/ui/components/badge"
import { formatMMK } from "@/lib/menu"
import { usePosCopy } from "@/lib/pos-copy"

export function OrderSummary({
  order,
  payment,
}: {
  order: {
    lines: {
      itemId: string
      name: string
      quantity: number
      unitPrice: number
    }[]
    total: number
    note: string
    status: "pending" | "cooking" | "served"
    destination: { kind: "takeaway" } | { kind: "table"; number: number } | null
  }
  payment: boolean
}) {
  const pos = usePosCopy()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{pos[order.status]}</Badge>
        <Badge variant={payment ? "secondary" : "outline"}>
          {payment ? pos.cashReceived : pos.unpaid}
        </Badge>
        <Badge variant="outline">
          {!order.destination
            ? pos.unassigned
            : order.destination.kind === "takeaway"
              ? pos.takeaway
              : `${pos.table} ${order.destination.number}`}
        </Badge>
      </div>
      <ul className="space-y-2 text-sm">
        {order.lines.map((line) => (
          <li key={line.itemId} className="flex justify-between gap-3">
            <span className="[overflow-wrap:anywhere]">
              {line.quantity} × {line.name}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatMMK(line.unitPrice * line.quantity)}
            </span>
          </li>
        ))}
      </ul>
      {order.note && (
        <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap text-muted-foreground">
          {order.note}
        </p>
      )}
      <div className="flex justify-between gap-3 border-t pt-3 font-medium">
        <span>{pos.total}</span>
        <span className="tabular-nums">{formatMMK(order.total)}</span>
      </div>
    </div>
  )
}
