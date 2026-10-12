/* eslint-disable turbo/no-undeclared-env-vars -- These secrets and deployment URLs belong to the Convex runtime, not Turborepo. */
import { ConvexError, v } from "convex/values"
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server"
import { internal } from "./_generated/api"
import { requireSimulator } from "./lib/payment_config"
import { eventSignature, type ProviderEvent } from "./lib/payment_protocol"
export const open = internalMutation({
  args: { attemptId: v.id("paymentAttempts") },
  handler: async (ctx, { attemptId }) => {
    requireSimulator()
    const attempt = await ctx.db.get(attemptId)
    if (!attempt) throw new ConvexError("INVALID_PAYMENT_ATTEMPT")
    const existing = await ctx.db
      .query("simulatorCheckouts")
      .withIndex("by_attempt", (q) => q.eq("attemptId", attemptId))
      .unique()
    if (!existing) {
      if ((await ctx.db.get(attempt.orderId))?.status === "cancelled") return
      if (
        (await ctx.db.query("simulatorControls").first())?.creationAvailable ===
        false
      )
        throw new ConvexError("PAYMENT_CREATE_UNCERTAIN")
      await ctx.db.insert("simulatorCheckouts", {
        attemptId,
        available: true,
        events: [],
      })
      if (attempt.status === "creating" || attempt.status === "uncertain")
        await ctx.db.patch(attemptId, {
          status: Date.now() >= attempt.expiresAt ? "expired" : "pending",
          terminalReconciled: false,
        })
    }
  },
})
const outcomeArgs = {
  attemptId: v.id("paymentAttempts"),
  outcome: v.union(
    v.literal("pending"),
    v.literal("uncertain"),
    v.literal("failed"),
    v.literal("expired"),
    v.literal("succeeded")
  ),
  transactionId: v.optional(v.string()),
  completedAt: v.optional(v.number()),
  omitCompletionTime: v.optional(v.boolean()),
}
export const setOutcome = internalMutation({
  args: outcomeArgs,
  handler: async (
    ctx,
    { attemptId, outcome, transactionId, completedAt, omitCompletionTime }
  ) => {
    requireSimulator()
    const attempt = await ctx.db.get(attemptId)
    const provider = await ctx.db
      .query("simulatorCheckouts")
      .withIndex("by_attempt", (q) => q.eq("attemptId", attemptId))
      .unique()
    if (!attempt || !provider) throw new ConvexError("INVALID_PAYMENT_ATTEMPT")
    if (outcome === "uncertain") {
      await ctx.db.patch(provider._id, { available: false })
      return
    }
    const identity = transactionId ?? `simulation:${attemptId}`
    const duplicate =
      outcome === "succeeded" &&
      provider.events.find(
        (e) => e.transactionId === identity && e.status === "succeeded"
      )
    const event: ProviderEvent = duplicate || {
      eventId: crypto.randomUUID(),
      reference: attempt.reference,
      merchant: attempt.merchant,
      purpose: attempt.purpose,
      currency: attempt.currency,
      amount: attempt.amount,
      status: outcome,
      ...(outcome === "succeeded"
        ? {
            transactionId: identity,
            ...(omitCompletionTime
              ? {}
              : { completedAt: completedAt ?? Date.now() }),
          }
        : {}),
    }
    await ctx.db.patch(provider._id, {
      available: true,
      events: duplicate ? provider.events : [...provider.events, event],
    })
  },
})
export const snapshot = internalMutation({
  args: { attemptId: v.id("paymentAttempts") },
  handler: async (ctx, { attemptId }) => {
    requireSimulator()
    const attempt = await ctx.db.get(attemptId)
    const provider = await ctx.db
      .query("simulatorCheckouts")
      .withIndex("by_attempt", (q) => q.eq("attemptId", attemptId))
      .unique()
    if (!attempt || !provider) return { available: false, events: [] }
    const last = provider.events.at(-1)
    if (
      provider.available &&
      Date.now() >= attempt.expiresAt &&
      (!last || last.status === "pending")
    ) {
      const events: ProviderEvent[] = [
        ...provider.events,
        {
          eventId: crypto.randomUUID(),
          reference: attempt.reference,
          merchant: attempt.merchant,
          purpose: attempt.purpose,
          currency: attempt.currency,
          amount: attempt.amount,
          status: "expired",
        },
      ]
      await ctx.db.patch(provider._id, { events })
      return { available: true, events }
    }
    return { available: provider.available, events: provider.events }
  },
})
export const events = internalQuery({
  args: { attemptId: v.id("paymentAttempts") },
  handler: async (ctx, { attemptId }) => {
    requireSimulator()
    return (
      (
        await ctx.db
          .query("simulatorCheckouts")
          .withIndex("by_attempt", (q) => q.eq("attemptId", attemptId))
          .unique()
      )?.events ?? []
    )
  },
})
export const attempts = internalQuery({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    requireSimulator()
    return ctx.db
      .query("paymentAttempts")
      .withIndex("by_order", (q) => q.eq("orderId", orderId))
      .collect()
  },
})
export const outcome = internalAction({
  args: { ...outcomeArgs, notify: v.optional(v.boolean()) },
  handler: async (ctx, { notify = true, ...args }): Promise<void> => {
    requireSimulator()
    await ctx.runMutation(internal.simulator.setOutcome, args)
    if (!notify) return
    const events: ProviderEvent[] = await ctx.runQuery(
      internal.simulator.events,
      { attemptId: args.attemptId }
    )
    for (const event of events) {
      const body = JSON.stringify(event),
        timestamp = String(Date.now())
      const response = await fetch(
        `${process.env.CONVEX_SITE_URL}/order-payment-events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Payment-Timestamp": timestamp,
            "X-Payment-Signature": await eventSignature(body, timestamp),
          },
          body,
        }
      )
      if (!response.ok) throw new ConvexError("PAYMENT_DELIVERY_FAILED")
    }
  },
})

export const creation = internalMutation({
  args: { available: v.boolean() },
  handler: async (ctx, { available }) => {
    requireSimulator()
    const control = await ctx.db.query("simulatorControls").first()
    if (control)
      await ctx.db.patch(control._id, { creationAvailable: available })
    else
      await ctx.db.insert("simulatorControls", { creationAvailable: available })
  },
})
