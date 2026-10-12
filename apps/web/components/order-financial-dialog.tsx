"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ConvexError } from "convex/values"
import { useMutation } from "convex/react"
import type { FunctionArgs, FunctionReturnType } from "convex/server"
import { api } from "@/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel, FieldError } from "@workspace/ui/components/field"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@workspace/ui/components/alert-dialog"
import { eligibleRefunds } from "@/lib/refund-eligibility"
import { EditorDialog } from "@workspace/ui/composed/editor-dialog"
import { TextField } from "@workspace/ui/composed/text-field"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { Feedback } from "@workspace/ui/composed/feedback"
import { useCopy } from "./language-switcher"
import { usePosCopy } from "@/lib/pos-copy"
import { usePosCommand } from "@/lib/use-pos-command"
import { formatMMK } from "@/lib/menu"
import type { OrderDialogSession } from "./workspace-order-dialog"

const schema = z.object({
  reason: z
    .string()
    .refine((value) => value.trim().length > 0)
    .max(2000),
})
type Detail = FunctionReturnType<typeof api.orders.detail>
type Frozen =
  | { kind: "cancel"; args: FunctionArgs<typeof api.orders.cancel> }
  | { kind: "refund"; args: FunctionArgs<typeof api.orders.recordRefund> }

export function OrderFinancialDialog({
  detail,
  session,
  open,
  onClose,
  finalFocus,
  popup,
  overlay,
}: {
  detail: Detail | undefined
  session: OrderDialogSession
  open: boolean
  onClose: () => void
  finalFocus: () => HTMLElement | null
  popup: string
  overlay: string
}) {
  const { copy } = useCopy()
  const pos = usePosCopy()
  const action = usePosCommand()
  const cancel = useMutation(api.orders.cancel)
  const refund = useMutation(api.orders.recordRefund)
  const [frozen, setFrozen] = useState<Frozen | null>(null)
  const locked = !!frozen
  const [selectedId, setSelectedId] = useState<string>("")
  const [when, setWhen] = useState<"now" | "earlier">("now")
  const [time, setTime] = useState("")
  const [invalid, setInvalid] = useState<"time" | "collection" | null>(null)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "" },
  })
  const isRefund = session.kind === "refund"
  const eligible = detail ? eligibleRefunds({ ...detail.order, ...detail }) : []
  // Selection is an identity only; the current collection always comes from Convex.
  const selected =
    eligible.find((collection) => collection._id === selectedId) ??
    (!selectedId ? eligible[0] : undefined)
  const cancellable =
    detail &&
    (detail.order.status === "pending" || detail.order.status === "cooking")
  const completed =
    !!detail &&
    !!frozen &&
    (frozen.kind === "cancel"
      ? detail.order.cancellation?.requestKey === frozen.args.requestKey
      : detail.refunds.some(
          (record) => record.requestKey === frozen.args.requestKey
        ))
  async function submit(values: z.infer<typeof schema>) {
    setInvalid(null)
    if (!detail || !action.ready()) {
      await action.run(async () => {})
      return
    }
    let command = frozen
    if (!command) {
      const input = {
        storeId: detail.order.storeId,
        orderId: detail.order._id,
        requestKey: crypto.randomUUID(),
        reason: values.reason,
      }
      if (isRefund) {
        const completedAt =
          when === "earlier" && time ? Date.parse(`${time}+06:30`) : undefined
        if (
          !selected ||
          (when === "earlier" && (!time || !Number.isFinite(completedAt)))
        ) {
          setInvalid(!selected ? "collection" : "time")
          return
        }
        command = {
          kind: "refund",
          args: { ...input, collectionId: selected._id, completedAt },
        }
      } else command = { kind: "cancel", args: input }
      setFrozen(command)
    }
    const success = await action.run(async () => {
      try {
        return await (command.kind === "cancel"
          ? cancel(command.args)
          : refund(command.args))
      } catch (error) {
        if (error instanceof ConvexError) {
          if (error.data === "INVALID_REFUND_DATE") setInvalid("time")
          setFrozen(null)
        }
        throw error
      }
    })
    if (success) {
      document.getElementById(session.fallbackId)?.focus()
      onClose()
    }
  }
  const contents = (
    <form
      className="flex min-h-0 flex-col"
      onSubmit={form.handleSubmit(submit)}
    >
      <div className="min-h-0 space-y-4 overflow-y-auto px-6 py-5">
        {isRefund && (
          <>
            {!eligible.length && !completed && (
              <Feedback>{pos.refundNone}</Feedback>
            )}
            <Field>
              <FieldLabel htmlFor="refund-collection">
                {pos.collection}
              </FieldLabel>
              <Select
                value={selected?._id ?? ""}
                onValueChange={(value) => setSelectedId(value ?? "")}
                disabled={locked || action.pending || !eligible.length}
              >
                <SelectTrigger
                  id="refund-collection"
                  aria-invalid={invalid === "collection"}
                  aria-describedby={
                    invalid === "collection"
                      ? "refund-collection-error"
                      : undefined
                  }
                  className="h-auto min-h-10 w-full whitespace-normal"
                >
                  <SelectValue>
                    {selected
                      ? `${selected.method === "cash" ? pos.cashReceived : "MMQR"} · ${formatMMK(selected.amount)}`
                      : pos.collection}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((collection) => (
                    <SelectItem key={collection._id} value={collection._id}>
                      {collection.method === "cash" ? pos.cashReceived : "MMQR"}{" "}
                      · {formatMMK(collection.amount)} · {collection.reference}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {invalid === "collection" && (
                <FieldError id="refund-collection-error">
                  {pos.financialInvalid}
                </FieldError>
              )}
            </Field>
            {selected && (
              <p className="text-sm [overflow-wrap:anywhere] text-muted-foreground">
                {pos.reference}: {selected.reference}
              </p>
            )}
            <Field>
              <FieldLabel htmlFor="refund-when">{pos.completedAt}</FieldLabel>
              <Select
                value={when}
                onValueChange={(value) => setWhen(value as "now" | "earlier")}
                disabled={locked || action.pending}
              >
                <SelectTrigger id="refund-when" className="w-full">
                  <SelectValue>
                    {when === "now" ? pos.now : pos.earlier}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="now">{pos.now}</SelectItem>
                  <SelectItem value="earlier">{pos.earlier}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {when === "earlier" && (
              <TextField
                id="refund-time"
                label={pos.earlier}
                type="datetime-local"
                step="1"
                description={pos.yangonTime}
                error={invalid === "time" ? pos.invalidRefundDate : undefined}
                value={time}
                onChange={(event) => setTime(event.target.value)}
                disabled={locked || action.pending}
              />
            )}
          </>
        )}
        <Field>
          <FieldLabel htmlFor="financial-reason">
            {isRefund ? pos.refundReason : pos.cancelReason}
          </FieldLabel>
          <Textarea
            id="financial-reason"
            {...form.register("reason")}
            maxLength={2000}
            aria-invalid={!!form.formState.errors.reason}
            aria-describedby={`reason-description${form.formState.errors.reason ? " financial-reason-error" : ""}`}
            disabled={locked || action.pending}
          />
          <p id="reason-description" className="text-xs text-muted-foreground">
            {pos.internalReason}
          </p>
          {form.formState.errors.reason && (
            <FieldError id="financial-reason-error">
              {isRefund ? pos.financialInvalid : pos.invalidCancel}
            </FieldError>
          )}
        </Field>
        {action.failure && invalid !== "time" && (
          <Feedback tone="error">{action.failure}</Feedback>
        )}
        {completed && (
          <Feedback>{isRefund ? pos.refunded : pos.cancelled}</Feedback>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-6 py-4">
        <Button
          type="button"
          variant="outline"
          disabled={action.pending}
          onClick={onClose}
        >
          {completed ? pos.close : copy.cancel}
        </Button>
        <SubmitButton
          variant={isRefund ? "default" : "destructive"}
          pending={action.pending}
          pendingLabel={copy.working}
          className="h-auto min-h-9 w-auto max-w-full whitespace-normal"
          disabled={
            !action.connected ||
            !detail ||
            completed ||
            (!locked && (isRefund ? !selected : !cancellable))
          }
        >
          {locked
            ? pos.retryFinancial
            : isRefund
              ? pos.recordRefund
              : pos.cancelOrder}
        </SubmitButton>
      </div>
    </form>
  )
  return isRefund ? (
    <EditorDialog
      open={open}
      title={pos.recordRefund}
      description={pos.refundIntro}
      closeLabel={pos.close}
      pending={action.pending}
      onClose={onClose}
      finalFocus={finalFocus}
      formLayout
      className={popup}
      overlayClassName={overlay}
    >
      {contents}
    </EditorDialog>
  ) : (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !action.pending) onClose()
      }}
    >
      <AlertDialogContent
        aria-label={pos.cancelOrder}
        finalFocus={finalFocus}
        overlayClassName={overlay}
        className={`flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl ${popup}`}
      >
        <AlertDialogHeader className="shrink-0 border-b px-6 py-5 text-left">
          <AlertDialogTitle>{pos.cancelOrder}</AlertDialogTitle>
          <AlertDialogDescription>{pos.cancelIntro}</AlertDialogDescription>
        </AlertDialogHeader>
        {contents}
      </AlertDialogContent>
    </AlertDialog>
  )
}
