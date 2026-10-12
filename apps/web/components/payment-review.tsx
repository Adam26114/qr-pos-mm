"use client"
import styles from "./orders.module.css"
import { useRef, useState } from "react"
import { usePaginatedQuery, useQuery } from "convex/react"
import type { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { usePaymentCopy } from "@/lib/payment-copy"
import { usePosCopy } from "@/lib/pos-copy"
import { useCopy } from "./language-switcher"
import { Button } from "@workspace/ui/components/button"
import { EditorDialog } from "@workspace/ui/composed/editor-dialog"
import { Feedback } from "@workspace/ui/composed/feedback"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { formatMMK } from "@/lib/menu"
import { eligibleRefunds } from "@/lib/refund-eligibility"
import {
  WorkspaceOrderDialog,
  orderDestination,
  type OrderDialogSession,
} from "./workspace-order-dialog"

export function PaymentReview({ storeId }: { storeId: Id<"stores"> }) {
  const text = usePaymentCopy(),
    pos = usePosCopy(),
    { copy } = useCopy()
  const summary = useQuery(api.payments.reviewSummary, { storeId })
  const [keyboard, setKeyboard] = useState(false)
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<
    (OrderDialogSession & { serial: number }) | null
  >(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const serial = useRef(0),
    trigger = useRef<HTMLButtonElement>(null)
  const page = usePaginatedQuery(
    api.payments.review,
    open ? { storeId } : "skip",
    { initialNumItems: 20 }
  )
  const focus = () =>
    trigger.current?.isConnected
      ? trigger.current
      : document.getElementById("orders-heading")
  function inspect(orderId: Id<"orders">, kind: "history" | "refund") {
    setOpen(false)
    setSession({
      serial: ++serial.current,
      kind,
      orderId,
      trigger: trigger.current,
      fallbackId: "orders-heading",
    })
    // The existing bill/refund dialog lives above the queue; no nested modal remains open.
    setDetailOpen(true)
  }
  return (
    <>
      {!summary?.ready ? (
        <Feedback>{text.preparing}</Feedback>
      ) : (
        summary.count > 0 && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3"
          >
            <p className="text-sm font-medium">
              {text.review} · {summary.count}
            </p>
            <Button
              ref={trigger}
              id="payment-review-control"
              variant="outline"
              className="h-auto max-w-full min-w-0 [overflow-wrap:anywhere] whitespace-normal"
              onClick={(event) => {
                setKeyboard(event.detail === 0)
                setOpen(true)
              }}
            >
              {text.review}
            </Button>
          </div>
        )
      )}
      <EditorDialog
        open={open}
        title={text.review}
        description={text.reviewIntro}
        closeLabel={pos.close}
        onClose={() => setOpen(false)}
        finalFocus={focus}
        className={`${styles.popup} ${keyboard ? styles.instant : ""}`}
        overlayClassName={`${styles.overlay} ${keyboard ? styles.instant : ""}`}
      >
        {page.status === "LoadingFirstPage" ? (
          <LoadingState label={copy.loading} />
        ) : !page.results.length ? (
          <Feedback>{text.none}</Feedback>
        ) : (
          <div className="space-y-3">
            {page.results.map((order) => (
              <article
                key={order._id}
                className="space-y-3 rounded-lg border p-3 [overflow-wrap:anywhere]"
              >
                <h3 className="font-semibold">
                  {orderDestination(order.destination, pos)} ·{" "}
                  {order._id.slice(-6).toUpperCase()}
                </h3>
                <p className="text-sm">
                  {pos[order.status]} · {text.retained}:{" "}
                  {formatMMK(order.money.retained)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="h-auto max-w-full min-w-0 [overflow-wrap:anywhere] whitespace-normal"
                    onClick={() => inspect(order._id, "history")}
                  >
                    {pos.history}
                  </Button>
                  {eligibleRefunds(order).length > 0 && (
                    <Button
                      variant="outline"
                      className="h-auto max-w-full min-w-0 [overflow-wrap:anywhere] whitespace-normal"
                      onClick={() => inspect(order._id, "refund")}
                    >
                      {pos.recordRefund}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {page.status === "CanLoadMore" && (
          <Button variant="outline" onClick={() => page.loadMore(20)}>
            {pos.loadMore}
          </Button>
        )}
      </EditorDialog>
      {session && (
        <WorkspaceOrderDialog
          key={session.serial}
          session={session}
          storeId={storeId}
          open={detailOpen}
          keyboard={keyboard}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  )
}
