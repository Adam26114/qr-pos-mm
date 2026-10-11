"use client"

import type { ReactNode } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"

type Entry = {
  id: string
  name: string
  quantity: number
  amount: string
  available: boolean
  image?: ReactNode
}
export function CartItems({
  entries,
  labels,
  onQuantity,
  onRemove,
  compact = false,
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
  compact?: boolean
}) {
  return (
    <ul className="space-y-4">
      {entries.map((entry) =>
        compact && onQuantity ? (
          <li
            key={entry.id}
            className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3"
          >
            <div className="relative">
              <div className="relative size-12 overflow-hidden rounded-lg bg-muted">
                {entry.image}
              </div>
              {onRemove && (
                <Button
                  size="icon-xs"
                  variant="secondary"
                  className="absolute -top-2 -left-2 rounded-full border border-border"
                  title={labels.remove}
                  aria-label={`${labels.remove}: ${entry.name}`}
                  onClick={() => onRemove(entry.id)}
                >
                  ×
                </Button>
              )}
            </div>
            <div className="min-w-0 space-y-1 text-sm">
              <p className="font-medium [overflow-wrap:anywhere]">
                {entry.name}
              </p>
              <p className="[overflow-wrap:anywhere] text-muted-foreground tabular-nums">
                {entry.amount}
              </p>
              {!entry.available && (
                <Badge variant="outline">{labels.unavailable}</Badge>
              )}
            </div>
            <div className="flex items-center rounded-lg border border-border">
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`${labels.decrease}: ${entry.name}`}
                onClick={() => onQuantity(entry.id, -1)}
              >
                −
              </Button>
              <span className="min-w-5 text-center text-sm tabular-nums">
                {entry.quantity}
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={entry.quantity >= 99 || !entry.available}
                aria-label={`${labels.increase}: ${entry.name}`}
                onClick={() => onQuantity(entry.id, 1)}
              >
                +
              </Button>
            </div>
          </li>
        ) : (
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
        )
      )}
    </ul>
  )
}
