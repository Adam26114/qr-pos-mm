"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, type Dispatch, type SetStateAction } from "react"
import {
  useConvex,
  useConvexConnectionState,
  useMutation,
  useQuery,
} from "convex/react"
import { ConvexError } from "convex/values"
import type { FunctionReturnType } from "convex/server"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@workspace/ui/components/select"
import { Feedback } from "@workspace/ui/composed/feedback"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { formatMMK } from "@/lib/menu"
import { useGuestCopy } from "@/lib/guest-copy"
import { useGuestRecovery, type GuestCommand } from "@/lib/guest-recovery"
import { usePosCopy } from "@/lib/pos-copy"
import { useOnline } from "@/lib/use-online"
import { useCopy } from "./language-switcher"
import type { CartLine } from "./pos-cart"
import { OrderSummary } from "./order-summary"
import { CartItems } from "@workspace/ui/composed/cart-items"

export type GuestMenu = NonNullable<
  FunctionReturnType<typeof api.publicMenu.read>
>
export function GuestCart({
  menu,
  recovery,
  lines,
  setLines,
  note,
  setNote,
  review,
  setReview,
}: {
  menu: GuestMenu
  recovery: ReturnType<typeof useGuestRecovery>
  lines: CartLine[]
  setLines: Dispatch<SetStateAction<CartLine[]>>
  note: string
  setNote: (note: string) => void
  review: GuestCommand["lines"] | null
  setReview: (review: GuestCommand["lines"] | null) => void
}) {
  const pos = usePosCopy()
  const text = useGuestCopy()
  const { copy } = useCopy()
  const online = useOnline()
  const connection = useConvexConnectionState()
  const connected = online && connection.isWebSocketConnected
  const client = useConvex()
  const router = useRouter()
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const failureMessages: Record<string, string> = {
    STORAGE_REQUIRED: text.storage,
    STORE_ACCESS_EXPIRED: pos.expired,
    PRICE_CHANGED: pos.priceChanged,
    ITEM_UNAVAILABLE: pos.itemUnavailable,
    INVALID_ORDER: pos.invalidOrder,
    INVALID_TABLE: pos.tableRemoved,
    TABLE_REMOVED: pos.tableRemoved,
    SUBMISSION_KEY_REUSED: text.conflict,
  }
  const [selected, setSelected] = useState<string | null>(null)
  const accepting = useQuery(api.guestOrders.accepting, {
    storeId: menu.store._id,
  })
  const attempt = recovery.attempt
  const receipt = useQuery(
    api.guestOrders.track,
    attempt ? { token: attempt.token } : "skip"
  )
  const submitOrder = useMutation(api.guestOrders.submit)
  const total = lines.reduce(
    (sum, line) =>
      sum +
      (menu.items.find((item) => item._id === line.itemId)?.price ?? 0) *
        line.quantity,
    0
  )
  const invalid =
    !lines.length ||
    lines.length > 100 ||
    lines.some(
      (line) => !menu.items.find((item) => item._id === line.itemId)?.available
    ) ||
    !Number.isSafeInteger(total) ||
    total < 1 ||
    note.length > 2000
  const changed = review?.some((line) => {
    const item = menu.items.find((item) => item._id === line.itemId)
    return !item?.available || item.price !== line.expectedPrice
  })
  const options = menu.tables.map((table) => ({
    value: table._id,
    label: `${pos.table} ${table.number}`,
  }))
  function quantity(itemId: Id<"menuItems">, delta: number) {
    setLines((current) =>
      current
        .map((line) =>
          line.itemId === itemId
            ? { ...line, quantity: Math.min(99, line.quantity + delta) }
            : line
        )
        .filter((line) => line.quantity > 0)
    )
  }
  async function submit() {
    if (
      busy.current ||
      !connected ||
      !navigator.onLine ||
      !client.connectionState().isWebSocketConnected ||
      recovery.broken
    )
      return
    if (
      !attempt &&
      (!review ||
        changed ||
        !accepting ||
        !options.some((option) => option.value === selected))
    )
      return
    busy.current = true
    setPending(true)
    setFailure(null)
    const input = attempt ?? {
      storeId: menu.store._id,
      tableId: selected as Id<"tables">,
      note,
      lines: review!,
      token: Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
        byte.toString(16).padStart(2, "0")
      ).join(""),
    }
    try {
      // Persist the exact command before sending. A transport failure must keep the same capability and payload.
      try {
        if (!attempt) recovery.save(input)
      } catch {
        setFailure("STORAGE_REQUIRED")
        return
      }
      try {
        await submitOrder(input)
        router.push(`/orders/${input.token}`)
      } catch (error) {
        if (
          error instanceof ConvexError &&
          error.data !== "SUBMISSION_KEY_REUSED"
        ) {
          try {
            recovery.clear(input.token)
          } catch {
            setFailure("STORAGE_REQUIRED")
            return
          }
          setReview(null)
          setFailure(
            typeof error.data === "string" ? error.data : "REQUEST_FAILED"
          )
        } else
          setFailure(
            error instanceof ConvexError &&
              error.data === "SUBMISSION_KEY_REUSED"
              ? "SUBMISSION_KEY_REUSED"
              : "REQUEST_FAILED"
          )
      }
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return (
    <section aria-label={pos.cart} className="min-w-0 lg:sticky lg:top-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{review ? text.review : pos.cart}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {attempt ? (
            receipt ? (
              <>
                <OrderSummary order={receipt.order} payment={receipt.paid} />
                <Button
                  render={<Link href={`/orders/${attempt.token}`} />}
                  nativeButton={false}
                  role="link"
                >
                  {text.track}
                </Button>
              </>
            ) : (
              <>
                <Feedback>{pos.unresolved}</Feedback>
                <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">
                  {attempt.note}
                </p>
                <SubmitButton
                  type="button"
                  pending={pending}
                  pendingLabel={copy.working}
                  disabled={!connected || receipt !== null || recovery.broken}
                  onClick={submit}
                >
                  {pos.retrySubmission}
                </SubmitButton>
              </>
            )
          ) : (
            <>
              {!lines.length && (
                <p className="text-sm text-muted-foreground">{pos.emptyCart}</p>
              )}
              <CartItems
                labels={{
                  increase: pos.increase,
                  decrease: pos.decrease,
                  remove: pos.remove,
                  unavailable: copy.unavailableItem,
                }}
                entries={lines.map((line) => {
                  const item = menu.items.find(
                    (item) => item._id === line.itemId
                  )
                  const reviewed = review?.find(
                    (entry) => entry.itemId === line.itemId
                  )
                  return {
                    id: line.itemId,
                    name: item?.name ?? pos.missingItem,
                    quantity: line.quantity,
                    amount: item
                      ? formatMMK(
                          (reviewed?.expectedPrice ?? item.price) *
                            line.quantity
                        )
                      : "—",
                    available: !!item?.available,
                  }
                })}
                onQuantity={
                  review
                    ? undefined
                    : (id, delta) => quantity(id as Id<"menuItems">, delta)
                }
                onRemove={
                  review
                    ? undefined
                    : (id) =>
                        setLines((current) =>
                          current.filter((line) => line.itemId !== id)
                        )
                }
              />
              {review ? (
                <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">
                  {note}
                </p>
              ) : (
                <Field>
                  <FieldLabel htmlFor="guest-note">{pos.note}</FieldLabel>
                  <Textarea
                    id="guest-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={2000}
                  />
                </Field>
              )}
              <div className="flex justify-between gap-4 border-t pt-4 font-semibold">
                <span>{pos.total}</span>
                <span className="tabular-nums">
                  {formatMMK(
                    review
                      ? review.reduce(
                          (sum, line) =>
                            sum + line.expectedPrice * line.quantity,
                          0
                        )
                      : total
                  )}
                </span>
              </div>
              {accepting === false && <Feedback>{pos.expired}</Feedback>}
              {review ? (
                <>
                  {changed && (
                    <Feedback tone="error">{text.reviewingChanged}</Feedback>
                  )}
                  {!options.length && <Feedback>{text.noTables}</Feedback>}
                  <Field>
                    <FieldLabel htmlFor="guest-table">{text.table}</FieldLabel>
                    <Select
                      value={selected}
                      onValueChange={setSelected}
                      items={options}
                      disabled={pending}
                    >
                      <SelectTrigger id="guest-table" className="w-full">
                        <SelectValue placeholder={text.chooseTable} />
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
                  <SubmitButton
                    className="w-full"
                    type="button"
                    pending={pending}
                    pendingLabel={copy.working}
                    disabled={
                      !connected ||
                      !accepting ||
                      !!changed ||
                      !options.some((option) => option.value === selected) ||
                      recovery.broken
                    }
                    onClick={submit}
                  >
                    {text.submit}
                  </SubmitButton>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setReview(null)
                      setSelected(null)
                    }}
                  >
                    {text.back}
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full"
                  disabled={
                    invalid || !connected || !accepting || recovery.broken
                  }
                  onClick={() => {
                    setFailure(null)
                    setReview(
                      lines.map((line) => ({
                        ...line,
                        expectedPrice: menu.items.find(
                          (item) => item._id === line.itemId
                        )!.price,
                      }))
                    )
                  }}
                >
                  {text.review}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">{text.cashNote}</p>
            </>
          )}
          {recovery.broken && <Feedback tone="error">{text.storage}</Feedback>}
          {failure && (
            <Feedback tone="error">
              {failureMessages[failure] ?? copy.requestFailed}
            </Feedback>
          )}
          {recovery.receipts.length > 0 && (
            <nav aria-label={text.previous} className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">{text.previous}</p>
              {recovery.receipts.map((token, index) => (
                <Button
                  key={token}
                  variant="outline"
                  className="mr-2"
                  render={<Link href={`/orders/${token}`} />}
                  nativeButton={false}
                  role="link"
                >
                  {text.track} {index + 1}
                </Button>
              ))}
            </nav>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
