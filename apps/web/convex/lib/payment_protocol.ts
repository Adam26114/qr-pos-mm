/* eslint-disable turbo/no-undeclared-env-vars -- These secrets and deployment URLs belong to the Convex runtime, not Turborepo. */
import { v, ConvexError } from "convex/values"
export const paymentStatus = v.union(
  v.literal("creating"),
  v.literal("pending"),
  v.literal("uncertain"),
  v.literal("failed"),
  v.literal("expired"),
  v.literal("succeeded")
)
export const providerEvent = v.object({
  eventId: v.string(),
  reference: v.string(),
  merchant: v.string(),
  purpose: v.string(),
  currency: v.string(),
  amount: v.number(),
  status: v.union(
    v.literal("pending"),
    v.literal("failed"),
    v.literal("expired"),
    v.literal("succeeded")
  ),
  transactionId: v.optional(v.string()),
  completedAt: v.optional(v.number()),
})
export type ProviderEvent = {
  eventId: string
  reference: string
  merchant: string
  purpose: string
  currency: string
  amount: number
  status: "pending" | "failed" | "expired" | "succeeded"
  transactionId?: string
  completedAt?: number
}
export async function eventSignature(body: string, timestamp: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.SIMULATOR_EVENT_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${timestamp}.${body}`)
      )
    ),
    (b) => b.toString(16).padStart(2, "0")
  ).join("")
}
export async function authenticateEvent(
  body: string,
  timestamp: string,
  signature: string
) {
  if (
    !/^\d{13}$/.test(timestamp) ||
    Math.abs(Date.now() - Number(timestamp)) > 300000 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    throw new ConvexError("INVALID_PAYMENT_SIGNATURE")
  const expected = await eventSignature(body, timestamp)
  let difference = 0
  for (let i = 0; i < expected.length; i++)
    difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  if (difference) throw new ConvexError("INVALID_PAYMENT_SIGNATURE")
}
