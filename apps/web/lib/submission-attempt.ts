"use client"
import { useMemo, useSyncExternalStore } from "react"
import { z } from "zod"
import type { FunctionArgs } from "convex/server"
import type { api } from "@/convex/_generated/api"

export type SubmissionAttempt = FunctionArgs<typeof api.orders.createCounter>
const schema = z.object({
  storeId: z.string(),
  submissionKey: z.string().min(8).max(100),
  note: z.string().max(2000),
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
const eventName = "qr-pos-submission-changed"
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(eventName, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(eventName, callback)
  }
}
export function useSubmissionAttempt(key: string, storeId: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    () => null
  )
  const attempt = useMemo(() => {
    if (!raw) return null
    try {
      const result = schema.safeParse(JSON.parse(raw))
      return result.success && result.data.storeId === storeId
        ? (result.data as SubmissionAttempt)
        : null
    } catch {
      return null
    }
  }, [raw, storeId])
  function save(value: SubmissionAttempt | null) {
    if (value) localStorage.setItem(key, JSON.stringify(value))
    else localStorage.removeItem(key)
    window.dispatchEvent(new Event(eventName))
  }
  return { attempt, save }
}
