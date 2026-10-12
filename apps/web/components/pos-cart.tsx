"use client"
import Link from "next/link"
import Image from "next/image"
import { HugeiconsIcon } from "@hugeicons/react"
import { ShoppingCart01Icon, Image01Icon } from "@hugeicons/core-free-icons"
import type { Dispatch, SetStateAction } from "react"
import { useMutation, useQuery } from "convex/react"
import { ConvexError } from "convex/values"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Textarea } from "@workspace/ui/components/textarea"
import { CartItems } from "@workspace/ui/composed/cart-items"
import { Feedback } from "@workspace/ui/composed/feedback"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { formatMMK, type MenuItem } from "@/lib/menu"
import { usePosCopy } from "@/lib/pos-copy"
import { usePosCommand } from "@/lib/use-pos-command"
import type { useSubmissionAttempt } from "@/lib/submission-attempt"
import { useCopy } from "./language-switcher"
import { OrderSummary } from "./order-summary"
import { OrderActions } from "./order-actions"

export type CartLine = { itemId: Id<"menuItems">; quantity: number }
export function PosCart({
  storeId,
  recovery,
  items,
  lines,
  setLines,
  note,
  setNote,
}: {
  storeId: Id<"stores">
  recovery: ReturnType<typeof useSubmissionAttempt>
  items: MenuItem[]
  lines: CartLine[]
  setLines: Dispatch<SetStateAction<CartLine[]>>
  note: string
  setNote: (note: string) => void
}) {
  const pos = usePosCopy()
  const { copy } = useCopy()
  const action = usePosCommand()
  const attempt = recovery.attempt
  const create = useMutation(api.orders.createCounter)
  const acceptedId = useQuery(
    api.orders.submission,
    attempt ? { storeId, submissionKey: attempt.submissionKey } : "skip"
  )
  const detail = useQuery(
    api.orders.detail,
    acceptedId ? { storeId, orderId: acceptedId } : "skip"
  )
  const tableData = useQuery(api.tables.list, { storeId })
  const total = lines.reduce(
    (sum, line) =>
      sum +
      (items.find((item) => item._id === line.itemId)?.price ?? 0) *
        line.quantity,
    0
  )
  const invalid =
    !lines.length ||
    lines.some(
      (line) => !items.find((item) => item._id === line.itemId)?.available
    ) ||
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    note.length > 2000
  function quantity(itemId: Id<"menuItems">, change: number) {
    setLines((current) =>
      current
        .map((line) =>
          line.itemId === itemId
            ? { ...line, quantity: Math.min(99, line.quantity + change) }
            : line
        )
        .filter((line) => line.quantity > 0)
    )
  }
  async function submit() {
    if (!action.ready()) return
    const input = attempt ?? {
      storeId,
      submissionKey: crypto.randomUUID(),
      note,
      lines: lines.map((line) => ({
        ...line,
        expectedPrice: items.find((item) => item._id === line.itemId)!.price,
      })),
    }
    if (!attempt) {
      try {
        recovery.save(input)
      } catch {
        action.setFailure("storageRequired")
        return
      }
    }
    await action.run(async () => {
      try {
        await create(input)
      } catch (error) {
        // A server rejection proves this command was not accepted. Transport failures remain recoverable.
        if (
          error instanceof ConvexError &&
          error.data !== "SUBMISSION_KEY_REUSED"
        )
          recovery.save(null)
        throw error
      }
    })
  }
  return (
    <section
      aria-label={pos.cart}
      className="min-w-0 space-y-4 lg:sticky lg:top-4"
    >
      <Card className="gap-0 py-0 shadow-none ring-border">
        <CardHeader className="border-b bg-muted/20 p-4">
          <CardTitle>
            <h2>{pos.cart}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-56 flex-col gap-5 p-4 xl:min-h-[calc(100dvh-22rem)]">
          {detail ? (
            <>
              <Badge variant="secondary">{pos.saved}</Badge>
              <OrderSummary
                order={detail.order}
                payment={!!detail.payment}
                money={detail.money}
                cashOnly={(detail.collections ?? []).every(
                  (c) => c.method === "cash"
                )}
              />
              <OrderActions
                order={{
                  ...detail.order,
                  payment: detail.payment,
                  collections: detail.collections,
                  refunds: detail.refunds,
                  money: detail.money,
                }}
                checkout
              />
              <Button
                variant="outline"
                render={<Link href="/workspace/orders" />}
                nativeButton={false}
              >
                {pos.orders}
              </Button>
              <Button
                className="w-full"
                onClick={() => {
                  try {
                    recovery.save(null)
                    setLines([])
                    setNote("")
                  } catch {
                    action.setFailure("storageRequired")
                  }
                }}
              >
                {pos.nextOrder}
              </Button>
            </>
          ) : attempt ? (
            <>
              <Feedback>{pos.unresolved}</Feedback>
              <p className="text-sm">{attempt.note}</p>
              <SubmitButton
                type="button"
                pending={action.pending}
                pendingLabel={copy.working}
                disabled={!action.connected || acceptedId !== null}
                onClick={submit}
              >
                {pos.retrySubmission}
              </SubmitButton>
            </>
          ) : (
            <>
              {!lines.length && (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center text-muted-foreground">
                  <HugeiconsIcon
                    icon={ShoppingCart01Icon}
                    aria-hidden="true"
                    className="size-10 opacity-40"
                  />
                  <p className="max-w-52 text-sm">{pos.emptyCart}</p>
                </div>
              )}
              <CartItems
                compact
                labels={{
                  increase: pos.increase,
                  decrease: pos.decrease,
                  remove: pos.remove,
                  unavailable: copy.unavailableItem,
                }}
                entries={lines.map((line) => {
                  const item = items.find((item) => item._id === line.itemId)
                  return {
                    id: line.itemId,
                    name: item?.name ?? pos.missingItem,
                    quantity: line.quantity,
                    amount: item ? formatMMK(item.price * line.quantity) : "—",
                    available: !!item?.available,
                    image: item?.photoUrl ? (
                      <Image
                        src={item.photoUrl}
                        alt=""
                        fill
                        unoptimized
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <HugeiconsIcon icon={Image01Icon} aria-hidden="true" />
                      </div>
                    ),
                  }
                })}
                onQuantity={(id, delta) =>
                  quantity(id as Id<"menuItems">, delta)
                }
                onRemove={(id) =>
                  setLines((current) =>
                    current.filter((line) => line.itemId !== id)
                  )
                }
              />
              {lines.length > 0 && (
                <Field className="mt-auto pt-4">
                  <FieldLabel htmlFor="cart-note">{pos.note}</FieldLabel>
                  <Textarea
                    id="cart-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={2000}
                  />
                </Field>
              )}
            </>
          )}
          {action.failure && <Feedback tone="error">{action.failure}</Feedback>}
        </CardContent>
      </Card>
      {!attempt && lines.length > 0 && (
        <Card className="gap-0 py-0 shadow-none ring-border">
          <CardContent className="gap-4 p-4">
            <div className="flex justify-between gap-4 font-semibold">
              <span>{pos.total}</span>
              <span className="tabular-nums">{formatMMK(total)}</span>
            </div>
            {tableData && !tableData.acceptingOrders && (
              <Feedback>{pos.expired}</Feedback>
            )}
            <SubmitButton
              className="w-full"
              type="button"
              pending={action.pending}
              pendingLabel={copy.working}
              disabled={
                invalid || !action.connected || !tableData?.acceptingOrders
              }
              onClick={submit}
            >
              {pos.saveOrder}
            </SubmitButton>
            <p className="text-xs text-muted-foreground">{pos.cashFlow}</p>
            <p className="text-xs text-muted-foreground">{pos.mmqrLater}</p>
          </CardContent>
        </Card>
      )}
      {!attempt && !lines.length && tableData && !tableData.acceptingOrders && (
        <Feedback>{pos.expired}</Feedback>
      )}
    </section>
  )
}
