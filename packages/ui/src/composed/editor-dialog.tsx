"use client"
import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog"
import { Button } from "@workspace/ui/components/button"

export function EditorDialog({
  open,
  onClose,
  title,
  description,
  closeLabel,
  pending = false,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  closeLabel: string
  pending?: boolean
  children: ReactNode
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <Button variant="outline" disabled={pending} onClick={onClose}>
          {closeLabel}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
