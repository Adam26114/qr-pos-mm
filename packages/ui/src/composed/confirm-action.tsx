"use client"

import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { AlertDialogTrigger } from "@workspace/ui/components/alert-dialog"
import {
  ConfirmDialog,
  type ConfirmationOptions,
} from "@workspace/ui/composed/confirm-dialog"

export function ConfirmAction(props: ConfirmationOptions) {
  const [open, setOpen] = useState(false)
  return (
    <ConfirmDialog {...props} open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="outline" title={props.label} />}
        aria-label={props.label}
        disabled={props.disabled}
      >
        {props.label}
      </AlertDialogTrigger>
    </ConfirmDialog>
  )
}
