"use client"
import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { ConfirmAction } from "@workspace/ui/composed/confirm-action"
import { Feedback } from "@workspace/ui/composed/feedback"
import { EditorDialog } from "@workspace/ui/composed/editor-dialog"
import { DestinationTiles } from "@workspace/ui/composed/destination-tiles"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { formatMMK } from "@/lib/menu"
import { usePosCopy } from "@/lib/pos-copy"
import { usePosCommand } from "@/lib/use-pos-command"
import { useCopy } from "./language-switcher"
import styles from "./orders.module.css"

export type WorkspaceOrder = FunctionReturnType<typeof api.orders.queue>[number]
type Order = WorkspaceOrder
type BoardActions = {
  onCash: (trigger: HTMLButtonElement) => void
  onAssign: (trigger: HTMLButtonElement) => void
  onAdvanced: (trigger: HTMLButtonElement) => void
}
export function OrderActions({
  board,
  ...props
}: {
  order: Order
  checkout?: boolean
  board?: BoardActions
}) {
  return board ? (
    <BoardOrderActions order={props.order} {...board} />
  ) : (
    <DefaultOrderActions {...props} />
  )
}

function BoardOrderActions({
  order,
  onCash,
  onAssign,
  onAdvanced,
}: { order: Order } & BoardActions) {
  const pos = usePosCopy()
  const { copy } = useCopy()
  const action = usePosCommand()
  const cook = useMutation(api.orders.startCooking)
  const serve = useMutation(api.orders.markServed)
  const command = { storeId: order.storeId, orderId: order._id }
  const needsCash =
    !order.payment && (order.source === "counter" || order.status === "served")
  const needsDestination =
    !order.destination && (order.source === "qr" || !!order.payment)
  const label = needsCash
    ? pos.paymentReceived
    : needsDestination
      ? pos.assignDestination
      : order.status === "pending"
        ? pos.startCooking
        : order.destination?.kind === "takeaway"
          ? pos.handover
          : pos.markServed
  if (order.status === "served" && order.payment) return null
  return (
    <div className="space-y-2">
      <SubmitButton
        type="button"
        pending={action.pending}
        pendingLabel={copy.working}
        disabled={!action.connected}
        className={`${styles.pressable} h-auto min-h-10 rounded-md px-3 py-2 whitespace-normal`}
        onClick={async (event) => {
          const trigger = event.currentTarget
          if (needsCash) onCash(trigger)
          else if (needsDestination) onAssign(trigger)
          else if (
            await action.run(() =>
              order.status === "pending" ? cook(command) : serve(command)
            )
          )
            onAdvanced(trigger)
        }}
      >
        {label}
      </SubmitButton>
      {!order.payment && order.source === "qr" && order.status !== "served" && (
        <Button
          variant="outline"
          className={`${styles.pressable} h-auto min-h-9 w-full px-3 py-2 whitespace-normal`}
          disabled={!action.connected || action.pending}
          onClick={(event) => onCash(event.currentTarget)}
        >
          {pos.paymentReceived}
        </Button>
      )}
      {action.failure && <Feedback tone="error">{action.failure}</Feedback>}
    </div>
  )
}

function DefaultOrderActions({
  order,
  checkout = false,
}: {
  order: Order
  checkout?: boolean
}) {
  const pos = usePosCopy()
  const { copy } = useCopy()
  const action = usePosCommand()
  const recordCash = useMutation(api.orders.recordCash)
  const assign = useMutation(api.orders.assignDestination)
  const cook = useMutation(api.orders.startCooking)
  const serve = useMutation(api.orders.markServed)
  const data = useQuery(api.tables.list, { storeId: order.storeId })
  const [selected, setSelected] = useState<string | null>(null)
  const [correcting, setCorrecting] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const command = { storeId: order.storeId, orderId: order._id }
  const id = `destination-${order._id}`
  const canAssign = order.source === "qr" || !!order.payment
  const options = [
    ...(order.source === "counter"
      ? [{ value: "takeaway", label: pos.takeaway }]
      : []),
    ...(data?.tables ?? []).map((table) => ({
      value: table._id,
      label: `${pos.table} ${table.number}`,
    })),
  ]
  const assignment = (
    <SubmitButton
      type="button"
      pending={action.pending}
      pendingLabel={copy.working}
      disabled={
        !selected ||
        !action.connected ||
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
          setCorrecting(false)
          setChoosing(false)
        })
      }
    >
      {pos.assignDestination}
    </SubmitButton>
  )
  return (
    <div className="space-y-3">
      {!order.payment && (
        <ConfirmAction
          label={pos.paymentReceived}
          title={pos.cashTitle}
          description={`${pos.cashIntro} ${formatMMK(order.total)}`}
          cancelLabel={copy.keepAccess}
          pendingLabel={copy.working}
          failureMessage={copy.requestFailed}
          disabled={!action.connected}
          onConfirm={async () => {
            if (!action.ready()) throw new Error("Disconnected")
            await recordCash(command)
          }}
        />
      )}
      {canAssign &&
        (!order.destination || correcting) &&
        (checkout ? (
          <Button
            variant="outline"
            disabled={!action.connected || action.pending}
            onClick={() => {
              setSelected(null)
              setChoosing(true)
            }}
          >
            {pos.assignDestination}
          </Button>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor={id}>{pos.destination}</FieldLabel>
              <Select
                value={selected}
                onValueChange={setSelected}
                items={options}
                disabled={!action.connected || action.pending}
              >
                <SelectTrigger id={id} className="w-full">
                  <SelectValue placeholder={pos.chooseDestination} />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {assignment}
          </>
        ))}
      {canAssign && order.destination && !correcting && (
        <Button
          variant="outline"
          disabled={!action.connected || action.pending}
          onClick={() => {
            setSelected(null)
            if (checkout) setChoosing(true)
            else setCorrecting(true)
          }}
        >
          {pos.correctDestination}
        </Button>
      )}
      {!checkout && order.status === "pending" && (
        <SubmitButton
          type="button"
          pending={action.pending}
          pendingLabel={copy.working}
          disabled={!canAssign || !order.destination || !action.connected}
          onClick={() => action.run(() => cook(command))}
        >
          {pos.startCooking}
        </SubmitButton>
      )}
      {!checkout && order.status === "cooking" && (
        <SubmitButton
          type="button"
          pending={action.pending}
          pendingLabel={copy.working}
          disabled={!action.connected}
          onClick={() => action.run(() => serve(command))}
        >
          {order.destination?.kind === "takeaway"
            ? pos.handover
            : pos.markServed}
        </SubmitButton>
      )}
      {action.failure && <Feedback tone="error">{action.failure}</Feedback>}
      {checkout && (
        <EditorDialog
          open={choosing && canAssign}
          title={pos.destination}
          description={pos.chooseDestination}
          closeLabel={pos.close}
          pending={action.pending}
          onClose={() => setChoosing(false)}
        >
          <DestinationTiles
            label={pos.destination}
            options={options}
            value={selected}
            onChange={setSelected}
            disabled={!action.connected || action.pending}
          />
          {assignment}
          {action.failure && <Feedback tone="error">{action.failure}</Feedback>}
        </EditorDialog>
      )}
    </div>
  )
}
