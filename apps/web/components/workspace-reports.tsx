"use client"

import { useState } from "react"
import { usePaginatedQuery, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import type { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { useReportCopy } from "@/lib/report-copy"
import { useReportPeriod } from "@/lib/use-report-period"
import { formatMMK } from "@/lib/menu"
import { usePosCopy } from "@/lib/pos-copy"
import { useCopy } from "./language-switcher"
import { useWorkspace } from "./workspace"
import {
  WorkspaceOrderDialog,
  orderDestination,
  type OrderDialogSession,
} from "./workspace-order-dialog"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@workspace/ui/components/tabs"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@workspace/ui/components/table"
import { TextField } from "@workspace/ui/composed/text-field"
import { MetricCard } from "@workspace/ui/composed/metric-card"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { Feedback } from "@workspace/ui/composed/feedback"

type Period = { storeId: Id<"stores">; kind: "day" | "month"; key: string }
type View = "collections" | "refunds" | "unpaid"
type FinancialRow = FunctionReturnType<
  typeof api.reports.collections
>["page"][number]
type UnpaidRow = FunctionReturnType<typeof api.reports.unpaid>["page"][number]
type OpenOrder = (
  id: Id<"orders">,
  trigger: HTMLElement,
  keyboard: boolean
) => void

export function WorkspaceReports({ storeId }: { storeId: Id<"stores"> }) {
  const { connected } = useWorkspace()
  const { copy, language } = useCopy()
  const report = useReportCopy()
  const { dates, selection, setSelection, key } = useReportPeriod(
    storeId,
    connected
  )
  const [view, setView] = useState<View>("collections")
  const [session, setSession] = useState<OrderDialogSession | null>(null)
  const [keyboard, setKeyboard] = useState(false)
  const args: Period | null =
    key && !selection.invalid ? { storeId, kind: selection.kind, key } : null
  const summary = useQuery(api.reports.summary, args ?? "skip")
  const openOrder: OpenOrder = (orderId, trigger, keyboard) => {
    setKeyboard(keyboard)
    setSession({
      kind: "history",
      orderId,
      trigger,
      fallbackId: "reports-table-heading",
    })
  }
  const number = (value: number) =>
    new Intl.NumberFormat(language === "my" ? "my-MM" : "en-GB").format(value)
  return (
    <section aria-label={report.reports} className="min-w-0 space-y-4">
      <h2 className="font-heading text-xl font-semibold">{report.reports}</h2>
      <Tabs
        value={selection.kind}
        onValueChange={(value) => {
          if (value === "day" || value === "month")
            setSelection({ kind: value, key: null, invalid: false })
        }}
        className="min-w-0 gap-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <TabsList variant="line" aria-label={report.reports}>
            <TabsTrigger value="day" className="transition-none">
              {report.day}
            </TabsTrigger>
            <TabsTrigger value="month" className="transition-none">
              {report.month}
            </TabsTrigger>
          </TabsList>
          <div className="w-full min-w-0 sm:w-48">
            <TextField
              id="report-period"
              label={
                selection.kind === "day" ? report.reportDay : report.reportMonth
              }
              type={selection.kind === "day" ? "date" : "month"}
              min={selection.kind === "day" ? "1970-01-01" : "1970-01"}
              max={selection.kind === "day" ? dates?.day : dates?.month}
              value={key ?? ""}
              disabled={!dates}
              className="h-9 rounded-md px-3 text-sm md:text-sm"
              error={selection.invalid ? report.invalidPeriod : undefined}
              onChange={(event) =>
                setSelection({
                  ...selection,
                  key: event.currentTarget.value,
                  invalid:
                    !event.currentTarget.value ||
                    !event.currentTarget.validity.valid,
                })
              }
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!dates}
            onClick={() =>
              setSelection({ ...selection, key: null, invalid: false })
            }
          >
            {selection.kind === "day" ? report.today : report.thisMonth}
          </Button>
        </div>
        <TabsContent value={selection.kind} className="min-w-0 space-y-4">
          <p className="text-xs text-muted-foreground">{report.timezone}</p>
          {selection.invalid ? null : !summary ? (
            <LoadingState label={copy.loading} />
          ) : !summary.ready ? (
            <Feedback>{report.preparing}</Feedback>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label={report.collected}
                  value={
                    <span className="[overflow-wrap:anywhere]">
                      {formatMMK(summary.collected)}
                    </span>
                  }
                  description={report.collectedNote}
                />
                <MetricCard
                  label={report.refunded}
                  value={
                    <span className="[overflow-wrap:anywhere]">
                      {formatMMK(summary.refunded)}
                    </span>
                  }
                  description={report.refundedNote}
                />
                <MetricCard
                  label={report.net}
                  value={
                    <span className="[overflow-wrap:anywhere]">
                      {formatMMK(summary.net)}
                    </span>
                  }
                  description={report.netNote}
                />
                <MetricCard
                  label={report.unpaid}
                  value={
                    <span className="[overflow-wrap:anywhere]">
                      {formatMMK(summary.unpaidAmount)}
                    </span>
                  }
                  description={`${report.unpaidNote} ${number(summary.unpaidCount)} ${report.orders}`}
                />
              </div>
              <h3
                id="reports-table-heading"
                tabIndex={-1}
                className="sr-only focus:not-sr-only"
              >
                {report.reports} ·{" "}
                {report[view === "unpaid" ? "unpaidOrders" : view]}
              </h3>
              <Tabs
                value={view}
                onValueChange={(value) => {
                  if (
                    value === "collections" ||
                    value === "refunds" ||
                    value === "unpaid"
                  )
                    setView(value)
                }}
                className="min-w-0 gap-4"
              >
                <div className="min-w-0 overflow-x-auto border-b">
                  <TabsList variant="line" aria-label={report.reports}>
                    <TabsTrigger
                      value="collections"
                      className="transition-none"
                    >
                      {report.collections}
                    </TabsTrigger>
                    <TabsTrigger value="refunds" className="transition-none">
                      {report.refunds}
                    </TabsTrigger>
                    <TabsTrigger value="unpaid" className="transition-none">
                      {report.unpaidOrders}
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value={view} className="min-w-0">
                  {view === "unpaid" ? (
                    <UnpaidTable storeId={storeId} onOpen={openOrder} />
                  ) : (
                    args && (
                      <FinancialTable
                        kind={view}
                        args={args}
                        onOpen={openOrder}
                      />
                    )
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </TabsContent>
      </Tabs>
      {session && (
        <WorkspaceOrderDialog
          session={session}
          storeId={storeId}
          open
          onClose={() => setSession(null)}
          keyboard={keyboard}
        />
      )}
    </section>
  )
}

function FinancialTable({
  kind,
  args,
  onOpen,
}: {
  kind: "collections" | "refunds"
  args: Period
  onOpen: OpenOrder
}) {
  const query = usePaginatedQuery(api.reports[kind], args, {
    initialNumItems: 20,
  })
  return (
    <ReportTable
      view={kind}
      rows={query.results}
      status={query.status}
      loadMore={() => query.loadMore(20)}
      onOpen={onOpen}
    />
  )
}

function UnpaidTable({
  storeId,
  onOpen,
}: {
  storeId: Id<"stores">
  onOpen: OpenOrder
}) {
  const query = usePaginatedQuery(
    api.reports.unpaid,
    { storeId },
    { initialNumItems: 20 }
  )
  return (
    <ReportTable
      view="unpaid"
      rows={query.results}
      status={query.status}
      loadMore={() => query.loadMore(20)}
      onOpen={onOpen}
    />
  )
}

function ReportTable({
  view,
  rows,
  status,
  loadMore,
  onOpen,
}: {
  view: View
  rows: (FinancialRow | UnpaidRow)[]
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted"
  loadMore: () => void
  onOpen: OpenOrder
}) {
  const { copy, language } = useCopy()
  const pos = usePosCopy()
  const report = useReportCopy()
  const time = (at: number) =>
    new Date(at).toLocaleString(language === "my" ? "my-MM" : "en-GB", {
      timeZone: "Asia/Yangon",
      dateStyle: "medium",
      timeStyle: "short",
    })
  const empty =
    view === "collections"
      ? report.emptyCollections
      : view === "refunds"
        ? report.emptyRefunds
        : report.emptyUnpaid
  if (status === "LoadingFirstPage")
    return <LoadingState label={copy.loading} />
  return (
    <div className="min-w-0 space-y-3">
      <div className="min-w-0 overflow-hidden rounded-xl border bg-card">
        <Table className="min-w-[44rem]">
          <caption className="sr-only">
            {report[view === "unpaid" ? "unpaidOrders" : view]}
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead>
                {view === "unpaid" ? report.created : report.eventTime}
              </TableHead>
              <TableHead>{report.bill}</TableHead>
              <TableHead>{report.destination}</TableHead>
              <TableHead>
                {view === "unpaid" ? report.status : report.method}
              </TableHead>
              {view !== "unpaid" && <TableHead>{report.reference}</TableHead>}
              <TableHead className="text-right">
                {view === "unpaid" ? report.amountDue : report.amount}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const financial = "order" in row
              const order = financial ? row.order : row
              const label = `${report.viewOrder} · ${order._id.slice(-6).toUpperCase()}`
              return (
                <TableRow
                  key={row._id}
                  data-testid={`report-row-${row._id}`}
                  className="transition-none"
                >
                  <TableCell className="text-xs">
                    {time(financial ? row.eventAt : row.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 transition-none"
                      aria-label={label}
                      onClick={(event) =>
                        onOpen(
                          order._id,
                          event.currentTarget,
                          event.detail === 0
                        )
                      }
                    >
                      {order._id.slice(-6).toUpperCase()}
                    </Button>
                  </TableCell>
                  <TableCell className="max-w-40 [overflow-wrap:anywhere] whitespace-normal">
                    {orderDestination(order.destination, pos)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {financial
                        ? row.method === "cash"
                          ? pos.cashReceived
                          : "MMQR"
                        : pos[order.status]}
                    </Badge>
                  </TableCell>
                  {financial && (
                    <TableCell className="max-w-52 text-xs [overflow-wrap:anywhere] whitespace-normal">
                      {row.reference}
                    </TableCell>
                  )}
                  <TableCell className="max-w-48 text-right font-medium [overflow-wrap:anywhere] whitespace-normal tabular-nums">
                    {formatMMK(financial ? row.amount : row.due)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {rows.length === 0 && (
          <p
            role="status"
            className="px-4 py-10 text-center text-sm text-muted-foreground"
          >
            {empty}
          </p>
        )}
      </div>
      {status !== "Exhausted" && (
        <Button
          variant="outline"
          disabled={status === "LoadingMore"}
          onClick={loadMore}
        >
          {status === "LoadingMore" ? copy.loading : pos.loadMore}
        </Button>
      )}
    </div>
  )
}
