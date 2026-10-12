import { paginationOptsValidator } from "convex/server"
import { requireStoreOwner } from "./lib/store_access"
import { syncPaymentReview } from "./lib/payment_review"
import { ConvexError, v } from "convex/values"
import {
  action,
  query,
  internalQuery,
  internalMutation,
  httpAction,
  type ActionCtx,
} from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"
import { paymentAccess, paymentOrder } from "./lib/payment_access"
import { requireSimulator, simulatorEnabled } from "./lib/payment_config"
import { authenticateEvent, providerEvent } from "./lib/payment_protocol"
import { createCheckout, checkCheckout } from "./lib/payment_adapter"
import { orderMoney } from "./lib/order_money"
import { reportCollection, reportUnpaid } from "./lib/reporting"

const guest = { token: v.string() }
const member = { storeId: v.id("stores"), orderId: v.id("orders") }
export const capabilities = query({
  args: {},
  handler: () => ({ simulator: simulatorEnabled() }),
})

export const current = internalQuery({
  args: { access: paymentAccess },
  handler: async (ctx, { access }) => {
    requireSimulator()
    const order = await paymentOrder(ctx, access)
    return order.paymentAttemptId
      ? await ctx.db.get(order.paymentAttemptId)
      : null
  },
})
export const prepare = internalMutation({
  args: { access: paymentAccess, requestKey: v.string() },
  handler: async (ctx, { access, requestKey }) => {
    requireSimulator()
    const order = await paymentOrder(ctx, access)
    if (requestKey.length < 8 || requestKey.length > 100)
      throw new ConvexError("INVALID_PAYMENT_REQUEST")
    if (order.paymentMethod !== "mmqr")
      throw new ConvexError("PAYMENT_METHOD_FIXED")
    const retry = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_request", (q) =>
        q.eq("orderId", order._id).eq("requestKey", requestKey)
      )
      .unique()
    if (retry) return retry
    const accepted = await ctx.db
      .query("paymentStartRequests")
      .withIndex("by_request", (q) =>
        q.eq("orderId", order._id).eq("requestKey", requestKey)
      )
      .unique()
    if (accepted) return (await ctx.db.get(accepted.attemptId))!
    if (order.status === "cancelled") throw new ConvexError("ORDER_CANCELLED")
    if ((await orderMoney(ctx, order)).money.funded)
      throw new ConvexError("PAYMENT_ALREADY_CONFIRMED")
    const active = order.paymentAttemptId
      ? await ctx.db.get(order.paymentAttemptId)
      : null
    if (
      active &&
      (!active.terminalReconciled ||
        !["failed", "expired"].includes(active.status))
    ) {
      await ctx.db.insert("paymentStartRequests", {
        orderId: order._id,
        requestKey,
        attemptId: active._id,
      })
      return active
    }
    const now = Date.now()
    const id = await ctx.db.insert("paymentAttempts", {
      orderId: order._id,
      storeId: order.storeId,
      requestKey,
      purpose: "order",
      merchant: `simulation:${order.storeId}`,
      currency: "MMK",
      amount: order.total,
      reference: `test:${crypto.randomUUID()}`,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000,
      status: "creating",
      terminalReconciled: false,
    })
    await ctx.db.patch(order._id, { paymentAttemptId: id })
    await ctx.scheduler.runAfter(15 * 60 * 1000, internal.payments.expire, {
      attemptId: id,
    })
    return (await ctx.db.get(id))!
  },
})
export const expire = internalMutation({
  args: { attemptId: v.id("paymentAttempts") },
  handler: async (ctx, { attemptId }) => {
    const attempt = await ctx.db.get(attemptId)
    if (
      attempt &&
      ["creating", "pending", "uncertain"].includes(attempt.status) &&
      Date.now() >= attempt.expiresAt
    )
      await ctx.db.patch(attemptId, {
        status: "expired",
        terminalReconciled: false,
      })
  },
})
export const uncertain = internalMutation({
  args: { attemptId: v.id("paymentAttempts") },
  handler: async (ctx, { attemptId }) => {
    requireSimulator()
    const attempt = await ctx.db.get(attemptId)
    if (attempt && attempt.status !== "succeeded")
      await ctx.db.patch(attemptId, {
        status: "uncertain",
        terminalReconciled: false,
      })
  },
})
async function reconcile(ctx: ActionCtx, attemptId: Id<"paymentAttempts">) {
  const result = await checkCheckout(ctx, attemptId)
  if (!result.available) {
    await ctx.runMutation(internal.payments.uncertain, { attemptId })
    return
  }
  for (const event of result.events)
    await ctx.runMutation(internal.payments.applyEvent, { event })
}
async function start(
  ctx: ActionCtx,
  access: { token: string } | { storeId: Id<"stores">; orderId: Id<"orders"> },
  requestKey: string
): Promise<Id<"paymentAttempts">> {
  const current = await ctx.runQuery(internal.payments.current, { access })
  if (
    current &&
    current.requestKey !== requestKey &&
    ["expired", "failed", "uncertain"].includes(current.status)
  )
    await reconcile(ctx, current._id)
  const attempt = await ctx.runMutation(internal.payments.prepare, {
    access,
    requestKey,
  })
  try {
    await createCheckout(ctx, attempt._id)
  } catch {
    await ctx.runMutation(internal.payments.uncertain, {
      attemptId: attempt._id,
    })
    throw new ConvexError("CHECKOUT_UNCERTAIN")
  }
  return attempt._id
}
export const startGuest = action({
  args: { ...guest, requestKey: v.string() },
  handler: (ctx, { token, requestKey }): Promise<Id<"paymentAttempts">> =>
    start(ctx, { token }, requestKey),
})
export const startCounter = action({
  args: { ...member, requestKey: v.string() },
  handler: (ctx, { requestKey, ...access }): Promise<Id<"paymentAttempts">> =>
    start(ctx, access, requestKey),
})
export const checkGuest = action({
  args: guest,
  handler: async (ctx, access): Promise<void> => {
    const attempt = await ctx.runQuery(internal.payments.current, { access })
    if (attempt) await reconcile(ctx, attempt._id)
  },
})
export const checkCounter = action({
  args: member,
  handler: async (ctx, access): Promise<void> => {
    const attempt = await ctx.runQuery(internal.payments.current, { access })
    if (attempt) await reconcile(ctx, attempt._id)
  },
})

async function checkout(
  ctx: Parameters<typeof paymentOrder>[0],
  access: Parameters<typeof paymentOrder>[1]
) {
  const order = await paymentOrder(ctx, access)
  const attempt = order.paymentAttemptId
    ? await ctx.db.get(order.paymentAttemptId)
    : null
  const { money } = await orderMoney(ctx, order)
  return {
    enabled: simulatorEnabled(),
    funded: money.funded,
    due: money.due,
    refunded: money.refunded,
    attempt: attempt
      ? {
          _id: attempt._id,
          status: attempt.status,
          expiresAt: attempt.expiresAt,
          simulated: true as const,
          testQr: `NON-PAYABLE-MMQR-TEST:${attempt._id}`,
          reconciled: attempt.terminalReconciled,
        }
      : null,
  }
}
export const guestCheckout = query({ args: guest, handler: checkout })
export const counterCheckout = query({ args: member, handler: checkout })

// This boundary accepts only authenticated adapter events; it is never a public payment mutation.
export const applyEvent = internalMutation({
  args: { event: providerEvent },
  handler: async (ctx, { event }) => {
    requireSimulator()
    const attempt = await ctx.db
      .query("paymentAttempts")
      .withIndex("by_reference", (q) => q.eq("reference", event.reference))
      .unique()
    if (
      !attempt ||
      event.merchant !== attempt.merchant ||
      event.purpose !== attempt.purpose ||
      event.currency !== attempt.currency ||
      event.amount !== attempt.amount ||
      !event.eventId ||
      event.eventId.length > 200
    )
      throw new ConvexError("PAYMENT_EVENT_MISMATCH")
    const now = Date.now()
    if (
      event.completedAt !== undefined &&
      (!Number.isSafeInteger(event.completedAt) ||
        event.completedAt < attempt.createdAt ||
        event.completedAt > now)
    )
      throw new ConvexError("INVALID_PAYMENT_DATE")
    const payload = JSON.stringify({
      ...event,
      completedAt: event.completedAt ?? null,
      transactionId: event.transactionId ?? null,
    })
    const previous = await ctx.db
      .query("paymentEvents")
      .withIndex("by_identity", (q) =>
        q.eq("merchant", event.merchant).eq("eventId", event.eventId)
      )
      .unique()
    if (previous) {
      if (previous.payload !== payload)
        throw new ConvexError("PAYMENT_EVENT_REUSED")
      return
    }
    const order = await ctx.db.get(attempt.orderId)
    if (
      !order ||
      order.storeId !== attempt.storeId ||
      order.paymentMethod !== "mmqr" ||
      order.total !== attempt.amount
    )
      throw new ConvexError("PAYMENT_EVENT_MISMATCH")
    if (event.status === "succeeded") {
      if (!event.transactionId || event.transactionId.length > 200)
        throw new ConvexError("INVALID_PAYMENT_TRANSACTION")
      const collected = await ctx.db
        .query("orderCollections")
        .withIndex("by_provider_transaction", (q) =>
          q
            .eq("providerMerchant", event.merchant)
            .eq("providerTransactionId", event.transactionId)
        )
        .unique()
      if (collected) {
        if (
          collected.orderId !== order._id ||
          collected.reference !== event.reference ||
          collected.amount !== event.amount ||
          (event.completedAt !== undefined &&
            collected.collectedAt !== event.completedAt)
        )
          throw new ConvexError("PAYMENT_TRANSACTION_REUSED")
      } else {
        const id = await ctx.db.insert("orderCollections", {
          storeId: order.storeId,
          orderId: order._id,
          amount: event.amount,
          currency: "MMK",
          method: "mmqr",
          reference: event.reference,
          collectedAt: event.completedAt ?? now,
          timeSource:
            event.completedAt === undefined
              ? "verification_fallback"
              : "provider_completed",
          recordedAt: now,
          recordedBy: "simulated-provider",
          simulated: true,
          providerMerchant: event.merchant,
          providerTransactionId: event.transactionId,
        })
        await reportCollection(ctx, id)
        await reportUnpaid(
          ctx,
          order._id,
          (await orderMoney(ctx, order)).money.due
        )
        await syncPaymentReview(ctx, order._id)
        await ctx.db.insert("orderEvents", {
          storeId: order.storeId,
          orderId: order._id,
          actorId: "simulated-provider",
          actorName: "MMQR simulation",
          kind: "mmqr_received",
          at: now,
        })
      }
      await ctx.db.patch(attempt._id, {
        status: "succeeded",
        terminalReconciled: true,
      })
    } else if (attempt.status !== "succeeded") {
      await ctx.db.patch(attempt._id, {
        status: event.status,
        terminalReconciled:
          event.status === "failed" || event.status === "expired",
      })
    }
    await ctx.db.insert("paymentEvents", {
      eventId: event.eventId,
      merchant: event.merchant,
      attemptId: attempt._id,
      at: now,
      payload,
      status: event.status,
    })
  },
})
export const ingest = httpAction(async (ctx, request) => {
  if (!simulatorEnabled()) return new Response("Unavailable", { status: 404 })
  const body = await request.text()
  if (body.length > 65536) return new Response("Invalid event", { status: 413 })
  try {
    await authenticateEvent(
      body,
      request.headers.get("X-Payment-Timestamp") ?? "",
      request.headers.get("X-Payment-Signature") ?? ""
    )
  } catch {
    return new Response("Invalid signature", { status: 403 })
  }
  try {
    await ctx.runMutation(internal.payments.applyEvent, {
      event: JSON.parse(body),
    })
    return new Response("Accepted")
  } catch {
    return new Response("Invalid event", { status: 400 })
  }
})

export const reviewSummary = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, { storeId }) => {
    await requireStoreOwner(ctx, storeId)
    const state = await ctx.db
      .query("reportStates")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .unique()
    return {
      ready: state?.paymentReviewReady ?? false,
      count: state?.paymentReviewReady ? (state.paymentReviewCount ?? 0) : 0,
    }
  },
})
export const review = query({
  args: { storeId: v.id("stores"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { storeId, paginationOpts }) => {
    await requireStoreOwner(ctx, storeId)
    const state = await ctx.db
      .query("reportStates")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .unique()
    if (!state?.paymentReviewReady)
      return { ready: false, page: [], isDone: true, continueCursor: "" }
    const page = await ctx.db
      .query("orders")
      .withIndex("by_store_payment_review", (q) =>
        q.eq("storeId", storeId).eq("paymentReviewRequired", true)
      )
      .order("asc")
      .paginate({
        ...paginationOpts,
        numItems: Math.min(100, paginationOpts.numItems),
      })
    return {
      ...page,
      ready: true,
      page: await Promise.all(
        page.page.map(async (order) => ({
          ...order,
          ...(await orderMoney(ctx, order)),
        }))
      ),
    }
  },
})
