"use client"

import { useRef, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  Edit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu"
import { ConfirmDialog } from "@workspace/ui/composed/confirm-dialog"
import { useCopy } from "./language-switcher"

export function MenuItemActions({
  name,
  disabled,
  onEdit,
  onRemove,
}: {
  name: string
  disabled: boolean
  onEdit: () => void
  onRemove: () => Promise<unknown>
}) {
  const { copy } = useCopy()
  const [removing, setRemoving] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const label = `${copy.itemActions}: ${name}`
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              ref={trigger}
              variant="outline"
              size="icon-sm"
              className="bg-background text-foreground shadow-md dark:bg-background dark:hover:bg-muted"
            />
          }
          aria-label={label}
          title={label}
          disabled={disabled}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            aria-label={copy.editItem}
            disabled={disabled}
            onClick={onEdit}
          >
            <HugeiconsIcon icon={Edit02Icon} aria-hidden="true" />
            {copy.editAction}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            aria-label={copy.removeFromSale}
            variant="destructive"
            disabled={disabled}
            onClick={() => setRemoving(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} aria-hidden="true" />
            {copy.deleteAction}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        finalFocus={trigger}
        label={copy.removeFromSale}
        title={copy.removeItemTitle}
        description={`${name} — ${copy.removeItemIntro}`}
        cancelLabel={copy.cancel}
        pendingLabel={copy.working}
        failureMessage={copy.requestFailed}
        disabled={disabled}
        onConfirm={onRemove}
      />
    </>
  )
}
