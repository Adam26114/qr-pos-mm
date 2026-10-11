"use client"

import { useState, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@workspace/ui/components/alert-dialog"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { Feedback } from "@workspace/ui/composed/feedback"

// Keep confirmation open until the command succeeds, including accessible error feedback.
export function ConfirmAction({
  label,
  title,
  description,
  cancelLabel,
  pendingLabel,
  failureMessage,
  disabled,
  onConfirm,
  triggerIcon,
}: {
  label: string
  title: string
  description: string
  cancelLabel: string
  pendingLabel: string
  failureMessage: string
  disabled?: boolean
  onConfirm: () => Promise<unknown>
  triggerIcon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  async function confirm() {
    if (pending || disabled) return
    setPending(true)
    setFailed(false)
    try {
      await onConfirm()
      setOpen(false)
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
          setOpen(value)
          setFailed(false)
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            size={triggerIcon ? "icon-sm" : "default"}
            title={label}
          />
        }
        aria-label={label}
        disabled={disabled}
      >
        {triggerIcon ?? label}
      </AlertDialogTrigger>
      <AlertDialogContent>
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
