import type { ReactNode } from "react"
import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardFooter,
} from "@workspace/ui/components/card"

export function MetricCard({
  label,
  value,
  description,
}: {
  label: string
  value: ReactNode
  description: string
}) {
  return (
    <Card
      role="region"
      aria-label={label}
      className="gap-4 bg-linear-to-t from-primary/5 to-card"
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      <CardFooter className="text-xs text-muted-foreground">
        {description}
      </CardFooter>
    </Card>
  )
}
