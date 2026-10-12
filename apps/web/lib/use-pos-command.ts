"use client"
import { useConvex } from "convex/react"
import { useRef, useState } from "react"
import { ConvexError } from "convex/values"
import { useWorkspace } from "@/components/workspace"
import { useCopy } from "@/components/language-switcher"
import { usePaymentCopy } from "./payment-copy"
import { usePosCopy } from "./pos-copy"

export function usePosCommand() {
  const client = useConvex()
  const { connected } = useWorkspace()
  const { copy } = useCopy()
  const pos = usePosCopy()
  const paymentText = usePaymentCopy()
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const failureMessages = {
    simulatorDisabled: paymentText.disabled,
    paymentRequired: paymentText.required,
    paymentFixed: paymentText.fixed,
    requestFailed: copy.requestFailed,
    cancelled: pos.orderCancelled,
    cannotCancel: pos.cannotCancel,
    invalidCancel: pos.invalidCancel,
    invalidRefund: pos.financialInvalid,
    refundDate: pos.invalidRefundDate,
    refundDuplicate: pos.refundDuplicate,
    refundNeedsCancel: pos.refundRequiredCancel,
    commandChanged: pos.keyReused,
    disconnected: copy.disconnected,
    expired: pos.expired,
    invalidOrder: pos.invalidOrder,
    priceChanged: pos.priceChanged,
    itemUnavailable: pos.itemUnavailable,
    keyReused: pos.keyReused,
    tableExists: pos.tableExists,
    invalidTable: pos.invalidTable,
    tableRemoved: pos.tableRemoved,
    tableRequired: pos.tableRequired,
    storageRequired: pos.storageRequired,
  }
  type FailureKey = keyof typeof failureMessages
  const [failureKey, setFailure] = useState<FailureKey | null>(null)
  function ready() {
    return (
      !busy.current &&
      connected &&
      navigator.onLine &&
      client.connectionState().isWebSocketConnected
    )
  }
  function errorKey(error: unknown): FailureKey {
    const codes: Record<string, FailureKey> = {
      SIMULATOR_DISABLED: "simulatorDisabled",
      PAYMENT_REQUIRED: "paymentRequired",
      PAYMENT_METHOD_FIXED: "paymentFixed",
      ORDER_CANCELLED: "cancelled",
      ORDER_NOT_CANCELLABLE: "cannotCancel",
      INVALID_CANCELLATION: "invalidCancel",
      INVALID_REFUND: "invalidRefund",
      INVALID_COLLECTION: "invalidRefund",
      INVALID_REFUND_DATE: "refundDate",
      ALREADY_REFUNDED: "refundDuplicate",
      CANCEL_BEFORE_REFUND: "refundNeedsCancel",
      COMMAND_KEY_REUSED: "commandChanged",
      STORE_ACCESS_EXPIRED: "expired",
      INVALID_ORDER: "invalidOrder",
      PRICE_CHANGED: "priceChanged",
      ITEM_UNAVAILABLE: "itemUnavailable",
      SUBMISSION_KEY_REUSED: "keyReused",
      TABLE_EXISTS: "tableExists",
      INVALID_TABLE: "invalidTable",
      TABLE_REMOVED: "tableRemoved",
      TABLE_REQUIRED: "tableRequired",
    }
    return error instanceof ConvexError && typeof error.data === "string"
      ? (codes[error.data] ?? "requestFailed")
      : "requestFailed"
  }
  async function run(command: () => Promise<unknown>) {
    if (pending || !ready()) {
      setFailure("disconnected")
      return false
    }
    busy.current = true
    setPending(true)
    setFailure(null)
    try {
      await command()
      return true
    } catch (error) {
      setFailure(errorKey(error))
      return false
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return {
    connected,
    pending,
    failure: failureKey ? failureMessages[failureKey] : null,
    setFailure,
    ready,
    run,
  }
}
