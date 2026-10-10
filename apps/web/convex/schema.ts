import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
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
    email: v.string(),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
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
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_store", ["storeId"])
    .index("by_store_email_status", ["storeId", "email", "status"]),
})
