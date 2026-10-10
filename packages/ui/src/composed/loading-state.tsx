import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

export function LoadingState({ label }: { label: string }) {
  return (
    <Card aria-busy="true">
      <CardContent className="gap-5">
        <p role="status" className="text-sm text-muted-foreground">
          {label}
        </p>
        <div aria-hidden="true" className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </CardContent>
    </Card>
  )
}
