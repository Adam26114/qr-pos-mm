import type { ReactNode } from "react"
import { Card, CardContent, CardFooter } from "@workspace/ui/components/card"
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
}: {
  title: string
  description?: string
  image: ReactNode
  price: ReactNode
  status?: ReactNode
  actions: ReactNode
  compact?: boolean
  tools?: ReactNode
}) {
  return (
    <Card className="h-full gap-0 overflow-hidden py-0">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {image}
      </div>
      <CardContent
        className={cn("flex flex-1 flex-col gap-3 p-4", compact && "gap-2 p-3")}
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-medium [overflow-wrap:anywhere]">{title}</h3>
          {description && (
            <p className="mt-1 text-xs [overflow-wrap:anywhere] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={cn(
              "font-medium tabular-nums",
              compact && "text-muted-foreground"
            )}
          >
            {price}
          </span>
          {compact ? actions : status}
        </div>
        {compact ? status : actions}
      </CardContent>
      {tools && (
        <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/20 p-3 [&_button]:h-10 [&_button]:min-w-0 [&_button]:flex-1 [&_button]:basis-24">
          {tools}
        </CardFooter>
      )}
    </Card>
  )
}
