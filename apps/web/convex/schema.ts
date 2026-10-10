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
  })
    .index("by_user", ["userId"])
    .index("by_store_user", ["storeId", "userId"]),
})
