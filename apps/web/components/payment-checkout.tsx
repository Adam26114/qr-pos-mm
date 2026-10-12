"use client"
import Image from "next/image"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  useAction,
  useConvex,
  useConvexConnectionState,
  useQuery,
} from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import type { Id } from "@/convex/_generated/dataModel"
import { api } from "@/convex/_generated/api"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { SubmitButton } from "@workspace/ui/composed/submit-button"
import { Feedback } from "@workspace/ui/composed/feedback"
import { useOnline } from "@/lib/use-online"
import { usePaymentCopy } from "@/lib/payment-copy"
import { useCopy } from "./language-switcher"

type Checkout = FunctionReturnType<typeof api.payments.counterCheckout>
type Access =
  { token: string } | { storeId: Id<"stores">; orderId: Id<"orders"> }
export function PaymentCheckout({
  access,
  cancelled = false,
  onPendingChange,
}: {
  access: Access
  cancelled?: boolean
  onPendingChange?: (pending: boolean) => void
}) {
  return "token" in access ? (
    <GuestCheckout
      token={access.token}
      cancelled={cancelled}
      onPendingChange={onPendingChange}
    />
  ) : (
    <CounterCheckout
      {...access}
      cancelled={cancelled}
      onPendingChange={onPendingChange}
    />
  )
}
function GuestCheckout({
  token,
  cancelled,
  onPendingChange,
}: {
  token: string
  cancelled: boolean
  onPendingChange?: (pending: boolean) => void
}) {
  const data = useQuery(api.payments.guestCheckout, { token })
  const start = useAction(api.payments.startGuest),
    check = useAction(api.payments.checkGuest)
  return (
    <CheckoutPanel
      onPendingChange={onPendingChange}
      data={data}
      storageKey={`guest:${token}`}
      cancelled={cancelled}
      start={(requestKey) => start({ token, requestKey })}
      check={() => check({ token })}
    />
  )
}
function CounterCheckout({
  storeId,
  orderId,
  cancelled,
  onPendingChange,
}: {
  storeId: Id<"stores">
  orderId: Id<"orders">
  cancelled: boolean
  onPendingChange?: (pending: boolean) => void
}) {
  const data = useQuery(api.payments.counterCheckout, { storeId, orderId })
  const start = useAction(api.payments.startCounter),
    check = useAction(api.payments.checkCounter)
  return (
    <CheckoutPanel
      onPendingChange={onPendingChange}
      data={data}
      storageKey={`order:${orderId}`}
      cancelled={cancelled}
      start={(requestKey) => start({ storeId, orderId, requestKey })}
      check={() => check({ storeId, orderId })}
    />
  )
}
function CheckoutPanel({
  data,
  storageKey,
  cancelled,
  start,
  check,
  onPendingChange,
}: {
  data: Checkout | undefined
  storageKey: string
  cancelled: boolean
  start: (requestKey: string) => Promise<unknown>
  check: () => Promise<unknown>
  onPendingChange?: (pending: boolean) => void
}) {
  const text = usePaymentCopy(),
    { copy, language } = useCopy()
  const client = useConvex(),
    online = useOnline(),
    connection = useConvexConnectionState()
  const connected = online && connection.isWebSocketConnected
  const [pending, setPending] = useState(false),
    [failure, setFailure] = useState<string | null>(null),
    [qr, setQr] = useState<{ payload: string; src: string } | null>(null)
  const busy = useRef(false),
    launched = useRef(false)
  const region = useRef<HTMLElement>(null)
  const focusedControl = useRef<HTMLElement | null>(null)
  const attempt = data?.attempt
  useLayoutEffect(() => {
    if (
      focusedControl.current &&
      !focusedControl.current.isConnected &&
      document.activeElement === document.body
    )
      region.current?.focus()
  }, [data?.funded, data?.refunded, attempt?.status])
  async function run(command: () => Promise<unknown>) {
    if (
      busy.current ||
      !navigator.onLine ||
      !client.connectionState().isWebSocketConnected
    )
      return
    busy.current = true
    setPending(true)
    onPendingChange?.(true)
    setFailure(null)
    try {
      await command()
    } catch (error) {
      setFailure(
        error instanceof ConvexError && error.data === "SIMULATOR_DISABLED"
          ? text.disabled
          : copy.requestFailed
      )
    } finally {
      busy.current = false
      setPending(false)
      onPendingChange?.(false)
    }
  }
  async function begin(retry = false) {
    await run(async () => {
      const key = `qr-pos-checkout:${storageKey}`
      const requestKey =
        (!retry && localStorage.getItem(key)) || crypto.randomUUID()
      localStorage.setItem(key, requestKey)
      await start(requestKey)
    })
  }
  useEffect(() => {
    if (
      !launched.current &&
      data?.enabled &&
      !data.attempt &&
      !data.funded &&
      data.due > 0 &&
      !cancelled &&
      connected
    ) {
      launched.current = true
      void begin()
    }
  })
  useEffect(() => {
    let active = true
    if (!attempt?.testQr) return
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(attempt.testQr, { width: 192, margin: 2 })
      )
      .then((value) => {
        if (active) setQr({ payload: attempt.testQr, src: value })
      })
      .catch(() => {
        if (active) setQr(null)
      })
    return () => {
      active = false
    }
  }, [attempt?.testQr])
  if (!data) return <Feedback>{copy.loading}</Feedback>
  if (!data.enabled) return <Feedback>{text.disabled}</Feedback>
  return (
    <section
      ref={region}
      tabIndex={-1}
      onFocusCapture={(event) => {
        focusedControl.current = event.target as HTMLElement
      }}
      onBlurCapture={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget as Node)
        )
          focusedControl.current = null
      }}
      aria-label={text.checkout}
      className="min-w-0 space-y-3 rounded-lg border p-4 [overflow-wrap:anywhere] focus-visible:outline-2 focus-visible:outline-primary"
    >
      <Badge variant="outline" className="h-auto whitespace-normal">
        {text.simulation}
      </Badge>
      {data.funded ? (
        <Feedback>{text.succeeded}</Feedback>
      ) : data.due === 0 && data.refunded > 0 ? (
        <Feedback>{text.refunded}</Feedback>
      ) : (
        <>
          <p className="text-sm">{text.warning}</p>
          {attempt && (
            <>
              {!cancelled &&
                qr?.payload === attempt.testQr &&
                (attempt.status === "pending" ||
                  attempt.status === "creating") && (
                  <div className="mx-auto w-fit rounded-lg bg-white p-2">
                    <Image
                      unoptimized
                      src={qr!.src}
                      width={192}
                      height={192}
                      alt={text.qr}
                    />
                  </div>
                )}
              <Feedback>{text[attempt.status]}</Feedback>
              <p className="text-xs text-muted-foreground">
                {text.expires}:{" "}
                {new Date(attempt.expiresAt).toLocaleString(
                  language === "my" ? "my-MM" : "en-GB",
                  { timeZone: "Asia/Yangon" }
                )}
              </p>
            </>
          )}
          {!cancelled && (
            <p className="text-xs text-muted-foreground">
              {text.beforeCooking}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {attempt ? (
              <SubmitButton
                type="button"
                variant="outline"
                pending={pending}
                pendingLabel={copy.working}
                disabled={!connected}
                onClick={() => run(check)}
              >
                {text.check}
              </SubmitButton>
            ) : (
              !cancelled && (
                <SubmitButton
                  type="button"
                  pending={pending}
                  pendingLabel={copy.working}
                  disabled={!connected}
                  onClick={() => begin()}
                >
                  {text.start}
                </SubmitButton>
              )
            )}
            {!cancelled &&
              attempt &&
              ["creating", "uncertain"].includes(attempt.status) && (
                <Button
                  variant="outline"
                  disabled={pending || !connected}
                  className="h-auto whitespace-normal"
                  onClick={() => begin()}
                >
                  {text.recover}
                </Button>
              )}
            {!cancelled &&
              attempt &&
              ["failed", "expired"].includes(attempt.status) && (
                <Button
                  variant="outline"
                  disabled={pending || !connected}
                  className="h-auto whitespace-normal"
                  onClick={() => begin(true)}
                >
                  {text.retry}
                </Button>
              )}
          </div>
        </>
      )}
      {failure && <Feedback tone="error">{failure}</Feedback>}
    </section>
  )
}
