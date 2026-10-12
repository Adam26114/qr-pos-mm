import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"
import { destination } from "./lib/order_values"

export default defineSchema({
  guestReceipts: defineTable({
    tokenHash: v.string(),
    storeId: v.id("stores"),
    orderId: v.id("orders"),
  }).index("by_token_hash", ["tokenHash"]),
  tables: defineTable({
    storeId: v.id("stores"),
    number: v.number(),
    removedAt: v.optional(v.number()),
  }).index("by_store", ["storeId"]),
  orders: defineTable({
    storeId: v.id("stores"),
    createdBy: v.string(),
    submissionKey: v.string(),
    payload: v.string(),
    createdAt: v.number(),
    source: v.union(v.literal("counter"), v.literal("qr")),
    lines: v.array(
      v.object({
        itemId: v.id("menuItems"),
        name: v.string(),
        unitPrice: v.number(),
        quantity: v.number(),
      })
    ),
    note: v.string(),
    total: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("cooking"),
      v.literal("served"),
      v.literal("cancelled")
    ),
    destination: v.union(destination, v.null()),
    cookingAt: v.optional(v.number()),
    servedAt: v.optional(v.number()),
    terminal: v.optional(v.boolean()),
    cancellation: v.optional(
      v.object({
        reason: v.string(),
        actorId: v.string(),
        actorName: v.string(),
        at: v.number(),
        requestKey: v.string(),
      })
    ),
    // Indexed queue membership for served bills awaiting cash; updated with service/payment atomically.
    cashCollectionPending: v.optional(v.boolean()),
    reportingDue: v.optional(v.number()),
    outstanding: v.optional(v.boolean()),
  })
    .index("by_submission", ["storeId", "createdBy", "submissionKey"])
    .index("by_store_status", ["storeId", "status"])
    .index("by_store_cash_collection", ["storeId", "cashCollectionPending"])
    .index("by_store_terminal", ["storeId", "terminal"])
    .index("by_cancel_request", ["storeId", "cancellation.requestKey"])
    .index("by_store_status_terminal", ["storeId", "status", "terminal"])
    .index("by_store_created", ["storeId", "createdAt"])
    .index("by_store_outstanding", ["storeId", "outstanding", "createdAt"]),
  cashPayments: defineTable({
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    amount: v.number(),
    receivedAt: v.number(),
    recordedBy: v.string(),
  })
    .index("by_order", ["orderId"])
    .index("by_store_received", ["storeId", "receivedAt"]),
  orderCollections: defineTable({
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    amount: v.number(),
    currency: v.literal("MMK"),
    method: v.union(v.literal("cash"), v.literal("mmqr")),
    reference: v.string(),
    collectedAt: v.number(),
    timeSource: v.union(
      v.literal("cash_recorded"),
      v.literal("provider_completed"),
      v.literal("verification_fallback")
    ),
    recordedAt: v.number(),
    recordedBy: v.string(),
    legacyCashPaymentId: v.optional(v.id("cashPayments")),
    reportingApplied: v.optional(v.boolean()),
  })
    .index("by_order", ["orderId"])
    .index("by_legacy_cash", ["legacyCashPaymentId"])
    .index("by_store_collected", ["storeId", "collectedAt"]),
  orderRefunds: defineTable({
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    collectionId: v.id("orderCollections"),
    amount: v.number(),
    currency: v.literal("MMK"),
    method: v.union(v.literal("cash"), v.literal("mmqr")),
    reference: v.string(),
    collectedAt: v.number(),
    collectionTimeSource: v.union(
      v.literal("cash_recorded"),
      v.literal("provider_completed"),
      v.literal("verification_fallback")
    ),
    completedAt: v.number(),
    recordedAt: v.number(),
    actorId: v.string(),
    actorName: v.string(),
    reason: v.string(),
    uncertainChronology: v.boolean(),
    reportingApplied: v.optional(v.boolean()),
    requestKey: v.string(),
    payload: v.string(),
  })
    .index("by_order", ["orderId"])
    .index("by_collection", ["collectionId"])
    .index("by_request", ["storeId", "requestKey"])
    .index("by_store_completed", ["storeId", "completedAt"]),
  orderEvents: defineTable({
    storeId: v.id("stores"),
    orderId: v.id("orders"),
    actorId: v.string(),
    actorName: v.string(),
    at: v.number(),
    kind: v.union(
      v.literal("cash_received"),
      v.literal("destination_changed"),
      v.literal("cooking"),
      v.literal("served"),
      v.literal("cancelled"),
      v.literal("refund_recorded")
    ),
    refundId: v.optional(v.id("orderRefunds")),
    reason: v.optional(v.string()),
    previousDestination: v.optional(v.union(destination, v.null())),
    destination: v.optional(destination),
  }).index("by_order", ["orderId"]),
  reportStates: defineTable({
    storeId: v.id("stores"),
    ready: v.boolean(),
    unpaidAmount: v.number(),
    unpaidCount: v.number(),
  }).index("by_store", ["storeId"]),
  reportDays: defineTable({
    storeId: v.id("stores"),
    day: v.string(),
    collected: v.number(),
    refunded: v.number(),
  }).index("by_store_day", ["storeId", "day"]),
  stores: defineTable({
    name: v.string(),
    ownerId: v.string(),
    trialStartedAt: v.number(),
    trialEndsAt: v.number(),
    expiredAt: v.optional(v.number()),
  }).index("by_owner", ["ownerId"]),
  memberships: defineTable({
    userId: v.string(),
    storeId: v.id("stores"),
    role: v.union(v.literal("owner"), v.literal("staff")),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_store", ["storeId"])
    .index("by_store_user", ["storeId", "userId"]),
  menuCategories: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    removedAt: v.optional(v.number()),
  }).index("by_store", ["storeId"]),
  menuItems: defineTable({
    storeId: v.id("stores"),
    categoryId: v.id("menuCategories"),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    available: v.boolean(),
    signature: v.optional(v.boolean()),
    photoId: v.union(v.id("menuPhotos"), v.null()),
    removedAt: v.optional(v.number()),
  })
    .index("by_store", ["storeId"])
    .index("by_category", ["categoryId"]),
  menuPhotos: defineTable({
    storeId: v.id("stores"),
    storageId: v.id("_storage"),
    uploadedBy: v.string(),
  }).index("by_store", ["storeId"]),
  staffInvitations: defineTable({
    storeId: v.id("stores"),
    // Missing kind denotes an existing email-bound invitation.
    kind: v.optional(v.union(v.literal("email"), v.literal("link"))),
    email: v.optional(v.string()),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    expiresInDays: v.optional(
      v.union(v.literal(1), v.literal(3), v.literal(7))
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("revoked")
    ),
    delivery: v.optional(
      v.union(v.literal("queued"), v.literal("sent"), v.literal("failed"))
    ),
    acceptedBy: v.optional(v.string()),
    acceptedAt: v.optional(v.number()),
    replacedBy: v.optional(v.id("staffInvitations")),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_store", ["storeId"])
    .index("by_store_email_status", ["storeId", "email", "status"]),
})
