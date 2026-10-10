import type { ComponentProps, ReactNode } from "react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@workspace/ui/components/card"

type FormCardProps = ComponentProps<typeof Card> & {
  title: string
  description?: string
  eyebrow?: string
  footer?: ReactNode
}

export function FormCard({
  title,
  description,
  eyebrow,
  footer,
  children,
  ...props
}: FormCardProps) {
  return (
    <Card {...props}>
      <CardHeader className="gap-3">
        {eyebrow && (
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            {eyebrow}
          </p>
        )}
        <CardTitle className="text-2xl font-semibold tracking-tight">
          <h2>{title}</h2>
        </CardTitle>
        {description && (
          <CardDescription className="leading-7">{description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && (
        <CardFooter className="border-t text-sm text-muted-foreground">
          {footer}
        </CardFooter>
      )}
    </Card>
  )
}
