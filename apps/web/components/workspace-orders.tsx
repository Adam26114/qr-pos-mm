"use client"
import { useMemo, useState } from "react"
import { useMutation, usePaginatedQuery, useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { FunctionReturnType } from "convex/server"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription,
} from "@workspace/ui/components/card"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { EditorDialog } from "@workspace/ui/composed/editor-dialog"
import { Feedback } from "@workspace/ui/composed/feedback"
import { useWorkspace } from "./workspace"
import { useCopy } from "./language-switcher"
import { usePosCopy } from "@/lib/pos-copy"
import { useOrderSound } from "@/lib/use-order-sound"
import { OrderActions } from "./order-actions"
import { OrderSummary } from "./pos-cart"

type Order = FunctionReturnType<typeof api.orders.queue>[number]
export function WorkspaceOrders() {
  const { workspace } = useWorkspace()
  if (!workspace.store) return null
  return <OrderQueue storeId={workspace.store._id} />
}
function OrderQueue({ storeId }: { storeId: Order["storeId"] }) {
  const { copy } = useCopy()
  const pos = usePosCopy()
  const { connected } = useWorkspace()
  const [view, setView] = useState<"open" | "served">("open")
  const queue = useQuery(api.orders.queue, { storeId })
  const history = usePaginatedQuery(
    api.orders.history,
    view === "served" ? { storeId } : "skip",
    { initialNumItems: 20 }
  )
  const ids = useMemo(
    () =>
      queue
        ?.filter(
          (order) =>
            order.status === "pending" && order.payment && order.destination
        )
        .map((order) => order._id),
    [queue]
  )
  const freshBaseline = useMutation(api.orders.soundBaseline)
  const sound = useOrderSound(ids, connected, () => freshBaseline({ storeId }))
  const orders = view === "open" ? queue : history.results
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold">{pos.orders}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{pos.liveIntro}</p>
        </div>
        <Button
          variant="outline"
          aria-pressed={sound.enabled}
          disabled={!connected || !queue}
          onClick={sound.toggle}
        >
          {sound.enabled ? pos.soundOff : pos.soundOn}
        </Button>
      </div>
      {sound.failed && <Feedback tone="error">{pos.soundFailed}</Feedback>}
      <div className="flex gap-2">
        <Button
          variant={view === "open" ? "default" : "outline"}
          aria-pressed={view === "open"}
          onClick={() => setView("open")}
        >
          {pos.liveOrders}
        </Button>
        <Button
          variant={view === "served" ? "default" : "outline"}
          aria-pressed={view === "served"}
          onClick={() => setView("served")}
        >
          {pos.served}
        </Button>
      </div>
      <section aria-label={view === "open" ? pos.liveOrders : pos.served}>
        {!orders ||
        (view === "served" && history.status === "LoadingFirstPage") ? (
          <LoadingState label={copy.loading} />
        ) : orders.length ? (
          <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {orders.map((order) => (
              <OrderCard key={order._id} order={order} />
            ))}
          </div>
        ) : (
          <Feedback>
            {view === "open" ? pos.noOpenOrders : pos.noHistory}
          </Feedback>
        )}
      </section>
      {view === "served" && history.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => history.loadMore(20)}>
          {pos.loadMore}
        </Button>
      )}
    </section>
  )
}
function OrderCard({ order }: { order: Order }) {
  const pos = usePosCopy()
  const { language } = useCopy()
  const [showHistory, setShowHistory] = useState(false)
  const detail = useQuery(
    api.orders.detail,
    showHistory ? { storeId: order.storeId, orderId: order._id } : "skip"
  )
  function destination(value: Order["destination"] | undefined) {
    return !value
      ? pos.unassigned
      : value.kind === "takeaway"
        ? pos.takeaway
        : `${pos.table} ${value.number}`
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>
            {pos.order} · {order._id.slice(-6).toUpperCase()}
          </h2>
        </CardTitle>
        <CardDescription>
          {new Date(order.createdAt).toLocaleString(
            language === "my" ? "my-MM" : "en-GB"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <OrderSummary order={order} payment={!!order.payment} />
        <OrderActions order={order} />
        <Button variant="ghost" onClick={() => setShowHistory(true)}>
          {pos.history}
        </Button>
      </CardContent>
      <EditorDialog
        open={showHistory}
        title={pos.history}
        closeLabel={pos.close}
        onClose={() => setShowHistory(false)}
      >
        <p className="text-sm">
          {pos.created}:{" "}
          {new Date(order.createdAt).toLocaleString(
            language === "my" ? "my-MM" : "en-GB"
          )}
        </p>
        <ol className="space-y-4">
          {detail?.events.map((event) => (
            <li key={event._id} className="space-y-1 border-t pt-3 text-sm">
              <p className="font-medium">
                {event.kind === "cash_received"
                  ? pos.cashReceived
                  : event.kind === "destination_changed"
                    ? pos.destinationChanged
                    : pos[event.kind]}
              </p>
              {event.kind === "destination_changed" && (
                <p>
                  {destination(event.previousDestination)} →{" "}
                  {destination(event.destination)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(event.at).toLocaleString(
                  language === "my" ? "my-MM" : "en-GB"
                )}{" "}
                · {event.actorName}
              </p>
            </li>
          ))}
        </ol>
      </EditorDialog>
    </Card>
  )
}
