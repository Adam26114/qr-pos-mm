import { internalMutation, mutation, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { ConvexError, v } from "convex/values"
import { authComponent } from "./auth"
import { requireStoreMembership, storeEntitlement } from "./lib/store_access"

export const create = mutation({
  args: { name: v.string() },
  returns: v.id("stores"),
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx)
    const name = args.name.trim()
    if (name.length < 2 || name.length > 80) {
      throw new ConvexError("INVALID_STORE_NAME")
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique()
    if (membership) {
      if (membership.role !== "owner") throw new ConvexError("OWNER_REQUIRED")
      return membership.storeId
    }
    const now = Date.now()
    const storeId = await ctx.db.insert("stores", {
      name,
      ownerId: user._id,
      trialStartedAt: now,
      trialEndsAt: now + 14 * 24 * 60 * 60 * 1000,
    })
    await ctx.db.insert("memberships", {
      userId: user._id,
      storeId,
      role: "owner",
    })
    await ctx.scheduler.runAt(
      now + 14 * 24 * 60 * 60 * 1000,
      internal.stores.expireTrial,
      { storeId }
    )
    return storeId
  },
})

export const workspace = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx)
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique()
    const store = membership ? await ctx.db.get(membership.storeId) : null
    return {
      user: { name: user.name, email: user.email },
      role: membership?.role ?? null,
      store,
      access: store ? storeEntitlement(store) : null,
    }
  },
})

export const get = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, { storeId }) => {
    const { store } = await requireStoreMembership(ctx, storeId)
    return { ...store, access: storeEntitlement(store) }
  },
})

export const expireTrial = internalMutation({
  args: { storeId: v.id("stores") },
  returns: v.null(),
  handler: async (ctx, { storeId }) => {
    const store = await ctx.db.get(storeId)
    if (store && Date.now() >= store.trialEndsAt && !store.expiredAt) {
      // Updating the document invalidates subscribed queries at the trial boundary.
      await ctx.db.patch(storeId, { expiredAt: store.trialEndsAt })
    }
    return null
  },
})
