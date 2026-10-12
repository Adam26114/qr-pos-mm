"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { useConvexConnectionState, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { Button } from "@workspace/ui/components/button"
import { FormCard } from "@workspace/ui/composed/form-card"
import { LoadingState } from "@workspace/ui/composed/loading-state"
import { Feedback } from "@workspace/ui/composed/feedback"
import { TextField } from "@workspace/ui/composed/text-field"
import { api } from "@/convex/_generated/api"
import { useGuestCopy } from "@/lib/guest-copy"
import { useGuestRecovery } from "@/lib/guest-recovery"
import { useOnline } from "@/lib/use-online"
import { LanguageSwitcher, useCopy } from "./language-switcher"
import { PaymentCheckout } from "./payment-checkout"
import { OrderSummary } from "./order-summary"

type Receipt = NonNullable<FunctionReturnType<typeof api.guestOrders.track>>
const subscribeOrigin = () => () => {}
export function GuestTracking({ token }: { token: string }) {
  const receipt = useQuery(api.guestOrders.track, { token })
  const text = useGuestCopy()
  const { copy } = useCopy()
  const online = useOnline()
  const connection = useConvexConnectionState()
  return (
    <main className="mx-auto min-h-dvh max-w-2xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <h1 className="font-heading text-2xl font-semibold [overflow-wrap:anywhere]">
          {receipt?.store.name ?? text.tracking}
        </h1>
        <LanguageSwitcher />
      </header>
      {(!online || !connection.isWebSocketConnected) && (
        <Feedback tone="error">
          {online ? copy.disconnected : copy.offline}
        </Feedback>
      )}
      {receipt === undefined ? (
        <LoadingState label={copy.loading} />
      ) : receipt === null ? (
        <FormCard title={text.missing} description={text.missingIntro}>
          {null}
        </FormCard>
      ) : (
        <ReceiptCard key={receipt.store._id} receipt={receipt} token={token} />
      )}
    </main>
  )
}
function ReceiptCard({ receipt, token }: { receipt: Receipt; token: string }) {
  const text = useGuestCopy()
  const { copy } = useCopy()
  const router = useRouter()
  const recovery = useGuestRecovery(receipt.store._id)
  const [failure, setFailure] = useState(false)
  const [copied, setCopied] = useState(false)
  const origin = useSyncExternalStore(
    subscribeOrigin,
    () => location.origin,
    () => ""
  )
  const link = `${origin}/orders/${token}`
  // Retain capabilities, never a second copy of the live order query.
  useEffect(() => {
    if (recovery.receipts.includes(token) && recovery.attempt?.token !== token)
      return
    try {
      recovery.retain(token)
    } catch {
      /* The missing retained capability below exposes a failed storage write. */
    }
  }, [recovery, token])
  return (
    <FormCard
      title={text.tracking}
      description={
        (receipt.money?.due ?? (receipt.paid ? 0 : receipt.order.total)) > 0
          ? receipt.order.paymentMethod === "cash"
            ? text.cashNote
            : undefined
          : undefined
      }
    >
      <div className="space-y-5">
        <OrderSummary
          order={receipt.order}
          payment={receipt.paid}
          money={receipt.money}
          cashOnly={receipt.cashOnly}
        />
        {receipt.order.paymentMethod === "mmqr" && (
          <PaymentCheckout
            access={{ token }}
            cancelled={receipt.order.status === "cancelled"}
          />
        )}
        <TextField
          id="tracking-link"
          label={text.link}
          value={link}
          readOnly
          onFocus={(event) => event.target.select()}
          description={text.privateLink}
        />
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              setCopied(true)
            } catch {
              setCopied(false)
              setFailure(true)
            }
          }}
        >
          {text.copyLink}
        </Button>
        {copied && <Feedback>{text.copied}</Feedback>}
        {(failure ||
          recovery.broken ||
          (!recovery.receipts.includes(token) &&
            recovery.attempt?.token !== token)) && (
          <Feedback tone="error">
            {recovery.broken || !recovery.receipts.includes(token)
              ? text.storage
              : copy.requestFailed}
          </Feedback>
        )}
        <Button
          className="w-full"
          onClick={() => {
            try {
              recovery.retain(token)
              router.push(`/menu/${receipt.store._id}`)
            } catch {
              setFailure(true)
            }
          }}
        >
          {text.again}
        </Button>
      </div>
    </FormCard>
  )
}
