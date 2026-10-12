"use client"
import { useMemo, useSyncExternalStore } from "react"
import { z } from "zod"
import type { FunctionArgs } from "convex/server"
import type { api } from "@/convex/_generated/api"

export type GuestCommand = FunctionArgs<typeof api.guestOrders.submit>
const token = z.string().regex(/^[a-f0-9]{64}$/)
const commandSchema = z.object({
  storeId: z.string(),
  token,
  tableId: z.string(),
  note: z.string().max(2000),
  paymentMethod: z.enum(["cash", "mmqr"]).optional(),
  lines: z
    .array(
      z.object({
        itemId: z.string(),
        quantity: z.number().int().min(1).max(99),
        expectedPrice: z.number().int().positive(),
      })
    )
    .min(1)
    .max(100),
})
const recordSchema = z.discriminatedUnion("version", [
  z.object({
    version: z.literal(1),
    command: commandSchema.refine(
      (command) => command.paymentMethod !== "mmqr"
    ),
  }),
  z.object({ version: z.literal(2), command: commandSchema }),
])
const changed = "qr-pos-guest-recovery-changed"
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(changed, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(changed, callback)
  }
}
function snapshot(prefix: string) {
  try {
    const records: [string, string | null][] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix))
        records.push([key.slice(prefix.length), localStorage.getItem(key)])
    }
    return JSON.stringify(records.sort(([a], [b]) => a.localeCompare(b)))
  } catch {
    return "unreadable"
  }
}
export function useGuestRecovery(storeId: string) {
  const prefix = `qr-pos-guest:${storeId}:`
  const raw = useSyncExternalStore(
    subscribe,
    () => snapshot(prefix),
    () => "[]"
  )
  const state = useMemo(() => {
    try {
      const records: [string, string | null][] = JSON.parse(raw)
      const attempts: GuestCommand[] = []
      const receipts: string[] = []
      for (const [key, value] of records) {
        const [kind, capability] = key.split(":")
        token.parse(capability)
        if (kind === "attempt") {
          const record = recordSchema.parse(JSON.parse(value!))
          if (
            record.command.storeId !== storeId ||
            record.command.token !== capability
          )
            return null
          attempts.push(record.command as GuestCommand)
        } else if (kind === "receipt" && value === "1")
          receipts.push(capability!)
        else return null
      }
      return { attempts, receipts }
    } catch {
      return null
    }
  }, [raw, storeId])
  function notify() {
    window.dispatchEvent(new Event(changed))
  }
  function save(command: GuestCommand) {
    if (!state) throw new Error("Unreadable recovery data")
    const key = `${prefix}attempt:${command.token}`
    const record = recordSchema.parse({
      version: command.paymentMethod === "mmqr" ? 2 : 1,
      command,
    })
    if (record.command.storeId !== storeId)
      throw new Error("Wrong recovery store")
    const encoded = JSON.stringify(record)
    const existing = localStorage.getItem(key)
    if (existing && existing !== encoded)
      throw new Error("Conflicting recovery command")
    // Independent immutable records cannot overwrite another tab's unresolved command.
    localStorage.setItem(key, encoded)
    notify()
  }
  function clear(capability: string) {
    localStorage.removeItem(`${prefix}attempt:${capability}`)
    notify()
  }
  function retain(capability: string) {
    token.parse(capability)
    // Persist the receipt first; if storage fails, its exact unresolved command remains recoverable.
    localStorage.setItem(`${prefix}receipt:${capability}`, "1")
    clear(capability)
  }
  return {
    attempt: state?.attempts[0] ?? null,
    receipts: state?.receipts ?? [],
    broken: state === null,
    save,
    clear,
    retain,
  }
}
