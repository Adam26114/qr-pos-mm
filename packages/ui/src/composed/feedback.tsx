import type { ComponentProps, ReactNode } from "react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { cn } from "@workspace/ui/lib/utils"

type FeedbackProps = Omit<
  ComponentProps<typeof Alert>,
  "role" | "variant" | "children"
> & {
  tone?: "error" | "status"
  children: ReactNode
}

export function Feedback({
  tone = "status",
  children,
  className,
  ...props
}: FeedbackProps) {
  return (
    <Alert
      {...props}
      variant={tone === "error" ? "destructive" : "default"}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        tone === "error"
          ? "border-destructive/20 bg-destructive/5"
          : "border-primary/20 bg-primary/5",
        className
      )}
    >
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
