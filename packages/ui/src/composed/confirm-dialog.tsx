"use client"

import { useState, type ReactNode, type ComponentProps } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@workspace/ui/components/alert-dialog"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { Feedback } from "@workspace/ui/composed/feedback"

export type ConfirmationOptions = {
  label: string
  title: string
  description: string
  cancelLabel: string
  pendingLabel: string
  failureMessage: string
  disabled?: boolean
  onConfirm: () => Promise<unknown>
  finalFocus?: ComponentProps<typeof AlertDialogContent>["finalFocus"]
}

// Keep confirmation mounted when the menu that opened it closes.
export function ConfirmDialog({
  open,
  onOpenChange,
  children,
  label,
  title,
  description,
  cancelLabel,
  pendingLabel,
  failureMessage,
  disabled,
  onConfirm,
  finalFocus,
}: ConfirmationOptions & {
  open: boolean
  onOpenChange: (open: boolean) => void
  children?: ReactNode
}) {
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  async function confirm() {
    if (pending || disabled) return
    setPending(true)
    setFailed(false)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }
  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) {
          onOpenChange(value)
          setFailed(false)
        }
      }}
    >
      {children}
      <AlertDialogContent finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {failed && <Feedback tone="error">{failureMessage}</Feedback>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <SubmitButton
            type="button"
            variant="destructive"
            pending={pending}
            pendingLabel={pendingLabel}
            disabled={disabled}
            onClick={confirm}
          >
            {label}
          </SubmitButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
