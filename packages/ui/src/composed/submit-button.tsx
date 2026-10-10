"use client"

import type { ComponentProps, ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type"> & {
  pending: boolean
  pendingLabel: ReactNode
}

export function SubmitButton({
  pending,
  pendingLabel,
  disabled,
  children,
  className,
  ...props
}: SubmitButtonProps) {
  return (
    <Button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={cn("h-12 w-full rounded-xl", className)}
    >
      {pending && <Spinner aria-hidden="true" role="presentation" />}
      {pending ? pendingLabel : children}
    </Button>
  )
}
