"use client"

import { PaymentCheckout } from "./payment-checkout"
import { usePaymentCopy } from "@/lib/payment-copy"
import { financialSnapshot } from "@/lib/refund-eligibility"
import { OrderFinancialDialog } from "./order-financial-dialog"
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
import { OrderTicket } from "@workspace/ui/composed/order-ticket"
import { Badge } from "@workspace/ui/components/badge"
import { OrderPaymentBadges } from "./order-payment-badges"
import { useCopy } from "./language-switcher"
import { usePosCopy } from "@/lib/pos-copy"
import { usePosCommand } from "@/lib/use-pos-command"
import { formatMMK } from "@/lib/menu"
import type { WorkspaceOrder } from "./order-actions"
import styles from "./orders.module.css"

export type OrderDialogSession = {
  kind: "cash" | "destination" | "history" | "cancel" | "refund" | "payment"
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
  const paymentText = usePaymentCopy()
  const queryDetail = useQuery(api.orders.detail, {
    storeId,
    orderId: session.orderId,
  })
  const detail = queryDetail
    ? {
        ...queryDetail,
        ...financialSnapshot({ ...queryDetail.order, ...queryDetail }),
      }
    : undefined
  const tables = useQuery(
    api.tables.list,
    session.kind === "destination" ? { storeId } : "skip"
  )
  const recordCash = useMutation(api.orders.recordCash)
  const assign = useMutation(api.orders.assignDestination)
  const action = usePosCommand()
  const [paymentPending, setPaymentPending] = useState(false)
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
    new Date(at).toLocaleString(language === "my" ? "my-MM" : "en-GB", {
      timeZone: "Asia/Yangon",
    })
  if (session.kind === "cancel" || session.kind === "refund")
    return (
      <OrderFinancialDialog
        detail={detail}
        session={session}
        open={open}
        onClose={onClose}
        finalFocus={finalFocus}
        popup={popup}
        overlay={overlay}
      />
    )
  if (session.kind === "payment")
    return (
      <EditorDialog
        open={open}
        pending={paymentPending}
        className={popup}
        overlayClassName={overlay}
        title={paymentText.checkout}
        closeLabel={pos.close}
        onClose={onClose}
        finalFocus={finalFocus}
      >
        <PaymentCheckout
          onPendingChange={setPaymentPending}
          access={command}
          cancelled={order?.status === "cancelled"}
        />
      </EditorDialog>
    )
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
        disabled={
          !detail ||
          detail.order.status === "cancelled" ||
          !!detail.payment ||
          !action.connected
        }
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
  const canAssign =
    !!order &&
    order.status !== "cancelled" &&
    (order.source === "qr" || !!detail?.payment)
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
            <OrderTicket
              id={`order-history-${detail.order._id}`}
              label={`${pos.order} · ${detail.order._id.slice(-6).toUpperCase()}`}
              destination={orderDestination(detail.order.destination, pos)}
              metadata={
                <>
                  {pos.created}: {date(detail.order.createdAt)} ·{" "}
                  {detail.order.source === "counter" ? pos.counterOrder : "QR"}
                </>
              }
              badges={
                <>
                  <Badge variant="outline">{pos[detail.order.status]}</Badge>
                  <OrderPaymentBadges
                    paid={detail.money.collected >= detail.order.total}
                    refunded={detail.money.refunded}
                    cashOnly={detail.collections.every(
                      (collection) => collection.method === "cash"
                    )}
                    cancelled={detail.order.status === "cancelled"}
                  />
                </>
              }
              lines={detail.order.lines.map((line) => ({
                key: line.itemId,
                name: line.name,
                quantity: line.quantity,
                amount: formatMMK(line.quantity * line.unitPrice),
              }))}
              note={detail.order.note}
              noteLabel={pos.note}
              total={formatMMK(detail.order.total)}
              totalLabel={pos.total}
              tools={null}
              actions={null}
            />
            {detail.collections.map((collection) => (
              <div
                key={collection._id}
                className="space-y-1 rounded-lg border p-3 text-sm [overflow-wrap:anywhere]"
              >
                <p className="font-medium">
                  {collection.method === "cash"
                    ? pos.cashReceived
                    : collection.simulated
                      ? paymentText.mmqr
                      : "MMQR"}{" "}
                  · {formatMMK(collection.amount)}
                </p>
                <p>
                  {pos.reference}: {collection.reference}
                </p>
                <p>
                  {pos.collectionTime}: {date(collection.collectedAt)}
                </p>
                <p>
                  {pos.recordedAt}: {date(collection.recordedAt)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pos[collection.timeSource]}
                </p>
              </div>
            ))}
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
                  {event.reason && (
                    <p className="whitespace-pre-wrap">{event.reason}</p>
                  )}
                  {event.kind === "refund_recorded" &&
                    detail.refunds
                      .filter((refund) => refund._id === event.refundId)
                      .map((refund) => (
                        <div key={refund._id} className="space-y-1">
                          <p>
                            {formatMMK(refund.amount)} ·{" "}
                            {refund.method === "cash"
                              ? pos.cashReceived
                              : refund.simulated
                                ? paymentText.mmqr
                                : "MMQR"}
                          </p>
                          <p>
                            {pos.reference}: {refund.reference}
                          </p>
                          <p className="whitespace-pre-wrap">{refund.reason}</p>
                          <p>
                            {pos.completedAt}: {date(refund.completedAt)}
                          </p>
                          <p>
                            {pos.recordedAt}: {date(refund.recordedAt)}
                          </p>
                          {refund.uncertainChronology && (
                            <Feedback>{pos.chronologyReview}</Feedback>
                          )}
                        </div>
                      ))}
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
