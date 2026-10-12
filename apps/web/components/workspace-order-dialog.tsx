"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { EditorDialog } from "@workspace/ui/composed/editor-dialog"
import { ConfirmDialog } from "@workspace/ui/composed/confirm-dialog"
import { DestinationTiles } from "@workspace/ui/composed/destination-tiles"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { Feedback } from "@workspace/ui/composed/feedback"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { useCopy } from "./language-switcher"
import { usePosCopy } from "@/lib/pos-copy"
import { usePosCommand } from "@/lib/use-pos-command"
import { formatMMK } from "@/lib/menu"
import type { WorkspaceOrder } from "./order-actions"
import styles from "./orders.module.css"

export type OrderDialogSession = {
  kind: "cash" | "destination" | "history"
  orderId: Id<"orders">
  trigger: HTMLElement | null
  fallbackId: string
}

export function orderDestination(
  value: WorkspaceOrder["destination"] | undefined,
  pos: ReturnType<typeof usePosCopy>
) {
  return !value
    ? pos.unassigned
    : value.kind === "takeaway"
      ? pos.takeaway
      : `${pos.table} ${value.number}`
}

// Lives outside the lanes: moving or collecting an order must not unmount its dialog.
export function WorkspaceOrderDialog({
  session,
  storeId,
  open,
  onClose,
  keyboard,
}: {
  session: OrderDialogSession
  storeId: Id<"stores">
  open: boolean
  onClose: () => void
  keyboard: boolean
}) {
  const { copy, language } = useCopy()
  const pos = usePosCopy()
  const detail = useQuery(api.orders.detail, {
    storeId,
    orderId: session.orderId,
  })
  const tables = useQuery(
    api.tables.list,
    session.kind === "destination" ? { storeId } : "skip"
  )
  const recordCash = useMutation(api.orders.recordCash)
  const assign = useMutation(api.orders.assignDestination)
  const action = usePosCommand()
  const [selected, setSelected] = useState<string | null>(null)
  const order = detail?.order
  const command = { storeId, orderId: session.orderId }
  const popup = `${styles.popup} ${keyboard ? styles.instant : ""}`
  const overlay = `${styles.overlay} ${keyboard ? styles.instant : ""}`
  const finalFocus = () =>
    session.trigger?.isConnected &&
    session.trigger.getClientRects().length &&
    !session.trigger.matches(":disabled, [aria-disabled='true']")
      ? session.trigger
      : document.getElementById(session.fallbackId)
  const date = (at: number) =>
    new Date(at).toLocaleString(language === "my" ? "my-MM" : "en-GB")
  if (session.kind === "cash")
    return (
      <ConfirmDialog
        open={open}
        onOpenChange={(value) => {
          if (!value) onClose()
        }}
        title={pos.cashTitle}
        label={pos.paymentReceived}
        description={
          !detail
            ? copy.loading
            : detail.payment
              ? pos.cashReceived
              : `${pos.cashIntro} ${formatMMK(detail.order.total)}`
        }
        cancelLabel={copy.cancel}
        pendingLabel={copy.working}
        failureMessage={copy.requestFailed}
        disabled={!detail || !!detail.payment || !action.connected}
        confirmVariant="default"
        finalFocus={finalFocus}
        className={popup}
        overlayClassName={overlay}
        onConfirm={async () => {
          if (!action.ready()) throw new Error("Disconnected")
          await recordCash(command)
        }}
      />
    )
  const options = [
    ...(order?.source === "counter"
      ? [{ value: "takeaway", label: pos.takeaway }]
      : []),
    ...(tables?.tables ?? []).map((table) => ({
      value: table._id,
      label: `${pos.table} ${table.number}`,
    })),
  ]
  const canAssign = !!order && (order.source === "qr" || !!detail?.payment)
  return (
    <EditorDialog
      open={open}
      title={session.kind === "history" ? pos.history : pos.destination}
      description={
        session.kind === "destination" ? pos.chooseDestination : undefined
      }
      closeLabel={pos.close}
      onClose={onClose}
      pending={action.pending}
      finalFocus={finalFocus}
      className={popup}
      overlayClassName={overlay}
      formLayout={session.kind === "destination"}
    >
      {session.kind === "history" ? (
        !detail ? (
          <LoadingState label={copy.loading} />
        ) : (
          <>
            <p className="text-sm">
              {pos.created}: {date(detail.order.createdAt)}
            </p>
            <ol className="space-y-4">
              {detail.events.map((event) => (
                <li
                  key={event._id}
                  className="space-y-1 border-l-2 pl-4 text-sm [overflow-wrap:anywhere]"
                >
                  <p className="font-medium">
                    {event.kind === "cash_received"
                      ? pos.cashReceived
                      : event.kind === "destination_changed"
                        ? pos.destinationChanged
                        : pos[event.kind]}
                  </p>
                  {event.kind === "destination_changed" && (
                    <p>
                      {orderDestination(event.previousDestination, pos)} →{" "}
                      {orderDestination(event.destination, pos)}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {date(event.at)} · {event.actorName}
                  </p>
                </li>
              ))}
            </ol>
          </>
        )
      ) : (
        <>
          <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
            {!order || !tables ? (
              <LoadingState label={copy.loading} />
            ) : (
              <>
                <p className="text-sm font-medium">
                  {orderDestination(order.destination, pos)}
                </p>
                <DestinationTiles
                  label={pos.destination}
                  options={options}
                  value={selected}
                  onChange={setSelected}
                  disabled={!canAssign || !action.connected || action.pending}
                />
              </>
            )}
            {action.failure && (
              <Feedback tone="error">{action.failure}</Feedback>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-6 py-4">
            <Button
              variant="outline"
              disabled={action.pending}
              className={styles.pressable}
              onClick={onClose}
            >
              {copy.cancel}
            </Button>
            <SubmitButton
              type="button"
              pending={action.pending}
              pendingLabel={copy.working}
              className={`${styles.pressable} h-auto min-h-9 w-auto rounded-md py-2 whitespace-normal`}
              disabled={
                !canAssign ||
                !action.connected ||
                !selected ||
                !options.some((option) => option.value === selected)
              }
              onClick={() =>
                action.run(async () => {
                  await assign({
                    ...command,
                    destination:
                      selected === "takeaway"
                        ? { kind: "takeaway" }
                        : { kind: "table", tableId: selected as Id<"tables"> },
                  })
                  onClose()
                })
              }
            >
              {pos.assignDestination}
            </SubmitButton>
          </div>
        </>
      )}
    </EditorDialog>
  )
}
