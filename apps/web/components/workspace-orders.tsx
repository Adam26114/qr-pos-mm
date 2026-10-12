"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, usePaginatedQuery, useQuery } from "convex/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  MoreHorizontalIcon,
  VolumeHighIcon,
  VolumeOffIcon,
} from "@hugeicons/core-free-icons"
import { api } from "@/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@workspace/ui/components/tabs"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@workspace/ui/components/dropdown-menu"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"
import { eligibleRefunds, financialSnapshot } from "@/lib/refund-eligibility"
import { OrderPaymentBadges } from "./order-payment-badges"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { Feedback } from "@workspace/ui/composed/feedback"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { OrderTicket } from "@workspace/ui/composed/order-ticket"
import { useWorkspace } from "./workspace"
import { useCopy } from "./language-switcher"
import { usePosCopy } from "@/lib/pos-copy"
import { useGuestCopy } from "@/lib/guest-copy"
import { useOrderSound } from "@/lib/use-order-sound"
import { isReadyToCook } from "@/lib/order-readiness"
import { formatMMK } from "@/lib/menu"
import { OrderActions, type WorkspaceOrder } from "./order-actions"
import {
  WorkspaceOrderDialog,
  orderDestination,
  type OrderDialogSession,
} from "./workspace-order-dialog"
import styles from "./orders.module.css"

type Order = WorkspaceOrder
const statuses = ["pending", "cooking", "served"] as const
type Lane = (typeof statuses)[number]

export function WorkspaceOrders() {
  const { workspace } = useWorkspace()
  if (!workspace.store) return null
  return <OrderQueue key={workspace.store._id} storeId={workspace.store._id} />
}

function OrderQueue({ storeId }: { storeId: Order["storeId"] }) {
  const { copy } = useCopy()
  const pos = usePosCopy()
  const { connected } = useWorkspace()
  const [view, setView] = useState<"open" | "served">("open")
  const [historyStatus, setHistoryStatus] = useState<
    "all" | "served" | "cancelled"
  >("all")
  const [lane, setLane] = useState<Lane>("pending")
  const [wide, setWide] = useState(false)
  const container = useRef<HTMLElement>(null)
  const [keyboard, setKeyboard] = useState(false)
  const [session, setSession] = useState<
    (OrderDialogSession & { serial: number }) | null
  >(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const serial = useRef(0)
  const [announcement, setAnnouncement] = useState("")
  useEffect(() => {
    const element = container.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWide(entry.contentRect.width >= 900)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const queue = useQuery(api.orders.queue, { storeId })
  const history = usePaginatedQuery(
    api.orders.history,
    view === "served"
      ? {
          storeId,
          ...(historyStatus === "all" ? {} : { status: historyStatus }),
        }
      : "skip",
    { initialNumItems: 20 }
  )
  const ids = useMemo(
    () =>
      queue
        ?.filter((order) => isReadyToCook(order, !!order.payment))
        .map((order) => order._id),
    [queue]
  )
  const freshBaseline = useMutation(api.orders.soundBaseline)
  const baseline = useCallback(
    () => freshBaseline({ storeId }),
    [freshBaseline, storeId]
  )
  const sound = useOrderSound(ids, connected, baseline)
  const laneLabels = {
    pending: pos.pending,
    cooking: pos.cooking,
    served: pos.awaitingCash,
  }
  const emptyLabels = {
    pending: pos.noPendingOrders,
    cooking: pos.noCookingOrders,
    served: pos.noAwaitingCash,
  }
  function fallbackId(order: Order) {
    return view === "served"
      ? "orders-history-heading"
      : `orders-lane-${order.status}`
  }
  function openDialog(
    order: Order,
    kind: OrderDialogSession["kind"],
    trigger: HTMLElement | null
  ) {
    setSession({
      kind,
      orderId: order._id,
      trigger,
      fallbackId: fallbackId(order),
      serial: ++serial.current,
    })
    setDialogOpen(true)
  }
  function advanced(order: Order) {
    setAnnouncement(
      `${pos.order} ${order._id.slice(-6).toUpperCase()} · ${order.status === "pending" ? pos.cooking : pos.served}`
    )
    requestAnimationFrame(() => {
      document.getElementById(fallbackId(order))?.focus()
    })
  }
  function ticket(order: Order) {
    return (
      <WorkspaceOrderTicket
        key={order._id}
        order={order}
        fresh={sound.newIds.includes(order._id)}
        keyboard={keyboard}
        history={view === "served"}
        onDialog={(kind, trigger) => openDialog(order, kind, trigger)}
        onAdvanced={() => advanced(order)}
      />
    )
  }
  const lanes = statuses.map((status) => ({
    status,
    orders: queue?.filter((order) => order.status === status) ?? [],
  }))
  return (
    <section
      ref={container}
      className="min-w-0 space-y-4"
      onPointerDownCapture={() => setKeyboard(false)}
      onKeyDownCapture={() => setKeyboard(true)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">{pos.orders}</h1>
        <SubmitButton
          type="button"
          pending={sound.pending}
          pendingLabel={copy.working}
          variant="outline"
          aria-pressed={sound.enabled}
          disabled={!connected || !queue}
          onClick={sound.toggle}
          className={`${styles.pressable} h-auto min-h-9 w-auto max-w-full gap-2 rounded-md px-3 py-2 whitespace-normal`}
        >
          <HugeiconsIcon
            icon={sound.enabled ? VolumeHighIcon : VolumeOffIcon}
            aria-hidden="true"
          />
          {sound.enabled ? pos.soundOff : pos.soundOn}
        </SubmitButton>
      </div>
      {sound.failed && <Feedback tone="error">{pos.soundFailed}</Feedback>}
      {sound.newIds.length > 0 && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2"
          role="status"
        >
          <p className="text-sm font-medium">
            {pos.newOrders}:{" "}
            <span className="tabular-nums">{sound.newIds.length}</span>
          </p>
          <Button
            variant="ghost"
            size="sm"
            className={`${styles.pressable} h-auto min-h-8 max-w-full whitespace-normal`}
            onClick={sound.acknowledge}
          >
            {pos.markSeen}
          </Button>
        </div>
      )}
      <p className="sr-only" role="status">
        {announcement}
      </p>
      <Tabs
        value={view}
        onValueChange={(value) => setView(value as "open" | "served")}
        className="min-w-0 gap-4"
      >
        <div className="overflow-x-auto border-b pb-1">
          <TabsList variant="line" className="h-10 gap-4">
            <TabsTrigger
              value="open"
              className="transition-none after:transition-none"
            >
              {pos.liveOrders}
            </TabsTrigger>
            <TabsTrigger
              value="served"
              className="transition-none after:transition-none"
            >
              {pos.historyTab}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="open" className="min-w-0">
          <section aria-label={pos.liveOrders} className="space-y-4">
            {!queue ? (
              <LoadingState label={copy.loading} />
            ) : (
              <>
                {!queue.length && <Feedback>{pos.noOpenOrders}</Feedback>}
                {wide ? (
                  <div className="grid grid-cols-3 items-start gap-4">
                    {lanes.map(({ status, orders }) => (
                      <section
                        key={status}
                        aria-labelledby={`orders-lane-${status}`}
                        className="min-w-0 space-y-3"
                      >
                        <h2
                          id={`orders-lane-${status}`}
                          tabIndex={-1}
                          className="flex min-h-10 flex-wrap items-center justify-between gap-2 px-1 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span>{laneLabels[status]}</span>
                          <Badge variant="secondary" className="tabular-nums">
                            {orders.length}
                          </Badge>
                        </h2>
                        {orders.length ? (
                          orders.map(ticket)
                        ) : (
                          <LaneEmpty label={emptyLabels[status]} />
                        )}
                      </section>
                    ))}
                  </div>
                ) : (
                  <Tabs
                    value={lane}
                    onValueChange={(value) => setLane(value as Lane)}
                    className="min-w-0 gap-4"
                  >
                    <div className="overflow-x-auto border-b pb-1">
                      <TabsList
                        variant="line"
                        className="h-10 gap-2"
                        aria-label={pos.orderStatuses}
                      >
                        {lanes.map(({ status, orders }) => (
                          <TabsTrigger
                            key={status}
                            value={status}
                            aria-label={`${laneLabels[status]} (${orders.length})`}
                            className="gap-2 transition-none after:transition-none"
                          >
                            {laneLabels[status]}
                            <Badge variant="secondary" className="tabular-nums">
                              {orders.length}
                            </Badge>
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>
                    {lanes.map(({ status, orders }) => (
                      <TabsContent
                        key={status}
                        value={status}
                        className="min-w-0 space-y-3"
                      >
                        <h2
                          id={`orders-lane-${status}`}
                          tabIndex={-1}
                          className="sr-only focus:not-sr-only"
                        >
                          {laneLabels[status]}
                        </h2>
                        {orders.length ? (
                          orders.map(ticket)
                        ) : (
                          <LaneEmpty label={emptyLabels[status]} />
                        )}
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
              </>
            )}
          </section>
        </TabsContent>
        <TabsContent value="served" className="min-w-0 space-y-4">
          <h2
            id="orders-history-heading"
            tabIndex={-1}
            className="sr-only focus:not-sr-only"
          >
            {pos.historyTab}
          </h2>
          <Select
            value={historyStatus}
            onValueChange={(value) =>
              setHistoryStatus(value as typeof historyStatus)
            }
          >
            <SelectTrigger
              aria-label={pos.historyFilter}
              className="max-w-full"
            >
              <SelectValue>
                {historyStatus === "all" ? pos.allHistory : pos[historyStatus]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{pos.allHistory}</SelectItem>
              <SelectItem value="served">{pos.served}</SelectItem>
              <SelectItem value="cancelled">{pos.cancelled}</SelectItem>
            </SelectContent>
          </Select>
          <section aria-label={pos.historyTab}>
            {history.status === "LoadingFirstPage" ? (
              <LoadingState label={copy.loading} />
            ) : history.results.length ? (
              <div
                className={`grid items-start gap-4 ${wide ? "grid-cols-3" : "sm:grid-cols-2"}`}
              >
                {history.results.map(ticket)}
              </div>
            ) : (
              <Feedback>{pos.noHistory}</Feedback>
            )}
          </section>
          {(history.status === "CanLoadMore" ||
            history.status === "LoadingMore") && (
            <SubmitButton
              type="button"
              variant="outline"
              pending={history.status === "LoadingMore"}
              pendingLabel={copy.loading}
              className={`${styles.pressable} h-9 w-auto rounded-md`}
              onClick={() => history.loadMore(20)}
            >
              {pos.loadMore}
            </SubmitButton>
          )}
        </TabsContent>
      </Tabs>
      {session && (
        <WorkspaceOrderDialog
          key={session.serial}
          storeId={storeId}
          session={session}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          keyboard={keyboard}
        />
      )}
    </section>
  )
}

function LaneEmpty({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex min-h-36 items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground"
    >
      {label}
    </div>
  )
}

function WorkspaceOrderTicket({
  order: rawOrder,
  fresh,
  keyboard,
  history,
  onDialog,
  onAdvanced,
}: {
  order: Order
  fresh: boolean
  keyboard: boolean
  history: boolean
  onDialog: (
    kind: OrderDialogSession["kind"],
    trigger: HTMLElement | null
  ) => void
  onAdvanced: (trigger: HTMLButtonElement) => void
}) {
  const pos = usePosCopy()
  const guest = useGuestCopy()
  const { language } = useCopy()
  const { connected, workspace } = useWorkspace()
  const financialReady =
    !!rawOrder.collections && !!rawOrder.refunds && !!rawOrder.money
  const order = financialSnapshot(rawOrder)
  const owner = workspace.role === "owner" && financialReady
  const refundable = eligibleRefunds(order).length > 0
  const trigger = useRef<HTMLButtonElement>(null)
  const label = `${pos.order} · ${order._id.slice(-6).toUpperCase()}`
  const created = new Date(order.createdAt)
  const locale = language === "my" ? "my-MM" : "en-GB"
  return (
    <OrderTicket
      id={`order-${order._id}`}
      label={label}
      destination={orderDestination(order.destination, pos)}
      fresh={fresh}
      metadata={
        <time
          dateTime={created.toISOString()}
          title={created.toLocaleString(locale)}
        >
          {created.toLocaleString(locale, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      }
      badges={
        <>
          <Badge variant="outline">
            {order.source === "qr" ? guest.qrOrder : pos.counterOrder}
          </Badge>
          {history && <Badge variant="outline">{pos[order.status]}</Badge>}
          <OrderPaymentBadges
            paid={!!order.payment}
            refunded={order.money.refunded}
            cashOnly={order.collections.every(
              (collection) => collection.method === "cash"
            )}
            cancelled={order.status === "cancelled"}
          />
          {fresh && <Badge>{pos.newOrder}</Badge>}
        </>
      }
      lines={order.lines.map((line) => ({
        key: line.itemId,
        name: line.name,
        quantity: line.quantity,
        amount: formatMMK(line.unitPrice * line.quantity),
      }))}
      note={order.note}
      noteLabel={pos.note}
      total={formatMMK(order.total)}
      totalLabel={pos.total}
      tools={
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                ref={trigger}
                variant="ghost"
                size="icon-sm"
                className={styles.pressable}
              />
            }
            aria-label={`${pos.orderActions}: ${label}`}
            title={`${pos.orderActions}: ${label}`}
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={`w-52 ${styles.popup} ${keyboard ? styles.instant : ""}`}
          >
            {order.status !== "cancelled" &&
              order.destination &&
              (order.source === "qr" || order.payment) && (
                <DropdownMenuItem
                  disabled={!connected}
                  onClick={() => onDialog("destination", trigger.current)}
                >
                  {pos.correctDestination}
                </DropdownMenuItem>
              )}
            {owner &&
              (order.status === "pending" || order.status === "cooking") && (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={!connected}
                  onClick={() => onDialog("cancel", trigger.current)}
                >
                  {pos.cancelOrder}
                </DropdownMenuItem>
              )}
            {owner && refundable && (
              <DropdownMenuItem
                disabled={!connected}
                onClick={() => onDialog("refund", trigger.current)}
              >
                {pos.recordRefund}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => onDialog("history", trigger.current)}
            >
              {pos.history}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      actions={
        order.status === "cancelled" ||
        (order.status === "served" && order.payment) ? null : (
          <OrderActions
            order={order}
            board={{
              onCash: (element) => onDialog("cash", element),
              onAssign: (element) => onDialog("destination", element),
              onAdvanced,
            }}
          />
        )
      }
    />
  )
}
