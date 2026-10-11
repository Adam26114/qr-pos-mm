"use client"
import type { ReactNode } from "react"
import { cn } from "cn"
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
  formLayout = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  closeLabel: string
  pending?: boolean
  children: ReactNode
  formLayout?: boolean
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !pending) onClose()
      }}
    >
      <DialogContent
        aria-label={title}
        showCloseButton={false}
        className={cn(
          "max-h-[90dvh] overflow-y-auto sm:max-w-xl",
          formLayout && "flex flex-col gap-0 overflow-hidden p-0"
        )}
      >
        <DialogHeader
          className={formLayout ? "shrink-0 border-b px-6 py-5" : undefined}
        >
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {formLayout ? (
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        ) : (
          children
        )}
        {!formLayout && (
          <Button variant="outline" disabled={pending} onClick={onClose}>
            {closeLabel}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
