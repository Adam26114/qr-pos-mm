"use client"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

type Entry = {
  id: string
  name: string
  quantity: number
  amount: string
  available: boolean
}
export function CartItems({
  entries,
  labels,
  onQuantity,
  onRemove,
}: {
  entries: Entry[]
  labels: {
    increase: string
    decrease: string
    remove: string
    unavailable: string
  }
  onQuantity?: (id: string, delta: number) => void
  onRemove?: (id: string) => void
}) {
  return (
    <ul className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="space-y-2 border-b pb-4">
          <div className="flex justify-between gap-2 text-sm">
            <span className="[overflow-wrap:anywhere]">
              {!onQuantity && `${entry.quantity} × `}
              {entry.name}
            </span>
            <span className="shrink-0 tabular-nums">{entry.amount}</span>
          </div>
          {!entry.available && (
            <Badge variant="outline">{labels.unavailable}</Badge>
          )}
          {onQuantity && (
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={`${labels.decrease}: ${entry.name}`}
                onClick={() => onQuantity(entry.id, -1)}
              >
                −
              </Button>
              <span className="min-w-6 text-center tabular-nums">
                {entry.quantity}
              </span>
              <Button
                size="icon-sm"
                variant="outline"
                disabled={entry.quantity >= 99 || !entry.available}
                aria-label={`${labels.increase}: ${entry.name}`}
                onClick={() => onQuantity(entry.id, 1)}
              >
                +
              </Button>
              {onRemove && (
                <Button
                  className="ml-auto"
                  size="sm"
                  variant="ghost"
                  aria-label={`${labels.remove}: ${entry.name}`}
                  onClick={() => onRemove(entry.id)}
                >
                  {labels.remove}
                </Button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
