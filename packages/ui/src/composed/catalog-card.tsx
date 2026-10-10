import type { ReactNode } from "react"
import { Card, CardContent } from "@workspace/ui/components/card"

export function CatalogCard({
  title,
  description,
  image,
  price,
  status,
  actions,
}: {
  title: string
  description?: string
  image: ReactNode
  price: ReactNode
  status?: ReactNode
  actions: ReactNode
}) {
  return (
    <Card className="h-full gap-0 overflow-hidden py-0">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {image}
      </div>
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium [overflow-wrap:anywhere]">{title}</h3>
          {description && (
            <p className="mt-1 text-xs [overflow-wrap:anywhere] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium tabular-nums">{price}</span>
          {status}
        </div>
        {actions}
      </CardContent>
    </Card>
  )
}
