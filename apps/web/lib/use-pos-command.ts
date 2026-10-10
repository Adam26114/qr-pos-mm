"use client"
import { useConvex } from "convex/react"
import { useRef, useState } from "react"
import { ConvexError } from "convex/values"
import { useWorkspace } from "@/components/workspace"
import { useCopy } from "@/components/language-switcher"
import { usePosCopy } from "./pos-copy"

export function usePosCommand() {
  const client = useConvex()
  const { connected } = useWorkspace()
  const { copy } = useCopy()
  const pos = usePosCopy()
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const failureMessages = {
    requestFailed: copy.requestFailed,
    disconnected: copy.disconnected,
    expired: pos.expired,
    invalidOrder: pos.invalidOrder,
    priceChanged: pos.priceChanged,
    itemUnavailable: pos.itemUnavailable,
    keyReused: pos.keyReused,
    tableExists: pos.tableExists,
    invalidTable: pos.invalidTable,
    tableRemoved: pos.tableRemoved,
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
      STORE_ACCESS_EXPIRED: "expired",
      INVALID_ORDER: "invalidOrder",
      PRICE_CHANGED: "priceChanged",
      ITEM_UNAVAILABLE: "itemUnavailable",
      SUBMISSION_KEY_REUSED: "keyReused",
      TABLE_EXISTS: "tableExists",
      INVALID_TABLE: "invalidTable",
      TABLE_REMOVED: "tableRemoved",
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
