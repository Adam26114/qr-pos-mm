import type { ReactNode } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@workspace/ui/components/card"

// Presentation only: callers supply formatted amounts, metadata, and authorized actions.
export function OrderTicket({
  id,
  label,
  destination,
  metadata,
  badges,
  lines,
  note,
  noteLabel,
  total,
  totalLabel,
  tools,
  actions,
  fresh = false,
}: {
  id: string
  label: string
  destination: string
  metadata: ReactNode
  badges: ReactNode
  lines: { key: string; name: string; quantity: number; amount: string }[]
  note: string
  noteLabel: string
  total: string
  totalLabel: string
  tools: ReactNode
  actions: ReactNode
  fresh?: boolean
}) {
  return (
    <Card
      size="sm"
      role="article"
      aria-label={label}
      id={id}
      className="min-w-0 gap-4 shadow-none data-[fresh=true]:ring-primary/50"
      data-fresh={fresh}
    >
      <CardHeader className="gap-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="font-heading text-lg font-semibold [overflow-wrap:anywhere]">
              {destination}
            </h3>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
          {tools}
        </div>
        <div className="text-xs text-muted-foreground">{metadata}</div>
        <div className="flex flex-wrap gap-1.5 [&_[data-slot=badge]]:h-auto [&_[data-slot=badge]]:max-w-full [&_[data-slot=badge]]:whitespace-normal">
          {badges}
        </div>
      </CardHeader>
      <CardContent className="gap-3">
        <ul className="space-y-2 text-sm">
          {lines.map((line) => (
            <li
              key={line.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2"
            >
              <span className="[overflow-wrap:anywhere]">
                <span className="font-medium tabular-nums">
                  {line.quantity} ×{" "}
                </span>
                {line.name}
              </span>
              <span className="max-w-28 text-right text-xs leading-5 [overflow-wrap:anywhere] tabular-nums">
                {line.amount}
              </span>
            </li>
          ))}
        </ul>
        {note && (
          <div className="rounded-md bg-muted/60 p-2.5">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {noteLabel}
            </p>
            <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">
              {note}
            </p>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2 border-t pt-3 font-semibold">
          <span>{totalLabel}</span>
          <span className="[overflow-wrap:anywhere] tabular-nums">{total}</span>
        </div>
      </CardContent>
      {actions && <CardFooter className="block">{actions}</CardFooter>}
    </Card>
  )
}
