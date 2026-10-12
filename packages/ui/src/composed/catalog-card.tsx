import type { ReactNode } from "react"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "cn"

export function CatalogCard({
  title,
  description,
  image,
  price,
  status,
  actions,
  compact = false,
  tools,
  headingLevel = 3,
}: {
  title: string
  description?: string
  image: ReactNode
  price: ReactNode
  status?: ReactNode
  actions: ReactNode
  compact?: boolean
  tools?: ReactNode
  headingLevel?: 3 | 4
}) {
  const Heading = headingLevel === 4 ? "h4" : "h3"
  return (
    <Card className="h-full min-w-0 gap-0 overflow-hidden py-0">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {image}
        {tools && (
          <div className="absolute top-2 right-2 flex gap-1">{tools}</div>
        )}
      </div>
      <CardContent
        className={cn("flex flex-1 flex-col gap-3 p-4", compact && "gap-2 p-3")}
      >
        <div className="min-w-0 flex-1">
          <Heading className="font-medium [overflow-wrap:anywhere]">
            {title}
          </Heading>
          {description && (
            <p className="mt-1 text-xs [overflow-wrap:anywhere] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2",
            compact && "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-1"
          )}
        >
          <span
            className={cn(
              "max-w-full min-w-0 font-medium [overflow-wrap:anywhere] tabular-nums",
              compact && "text-muted-foreground"
            )}
          >
            {price}
          </span>
          {compact ? actions : status}
        </div>
        {compact ? status : actions}
      </CardContent>
    </Card>
  )
}
