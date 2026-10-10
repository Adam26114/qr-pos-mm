"use client"

import type { ComponentProps } from "react"
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"

type TextFieldProps = ComponentProps<typeof Input> & {
  id: string
  label: string
  description?: string
  error?: string
}

export function TextField({
  id,
  label,
  description,
  error,
  className,
  "aria-describedby": describedBy,
  ...props
}: TextFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const invalid =
    Boolean(error) ||
    props["aria-invalid"] === true ||
    props["aria-invalid"] === "true"
  return (
    <Field data-invalid={invalid} data-disabled={props.disabled || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        {...props}
        id={id}
        className={cn("h-12 rounded-xl px-4 md:text-base", className)}
        aria-invalid={invalid}
        aria-describedby={
          [describedBy, descriptionId, errorId].filter(Boolean).join(" ") ||
          undefined
        }
      />
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  )
}
