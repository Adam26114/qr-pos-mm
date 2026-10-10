import { ConvexError } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { authComponent } from "../auth"

export function storeEntitlement(store: Doc<"stores">) {
  return {
    active: Date.now() < store.trialEndsAt,
    expiresAt: store.trialEndsAt,
  }
}

// New-order commands use this server-time guard, even if expiry notification is delayed.
export function assertAcceptingOrders(store: Doc<"stores">) {
  if (!storeEntitlement(store).active)
    throw new ConvexError("STORE_ACCESS_EXPIRED")
}

export async function requireStoreMembership(
  ctx: QueryCtx,
  storeId: Id<"stores">
) {
  const user = await authComponent.getAuthUser(ctx)
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_store_user", (q) =>
      q.eq("storeId", storeId).eq("userId", user._id)
    )
    .unique()
  if (!membership) throw new ConvexError("STORE_ACCESS_DENIED")
  const store = await ctx.db.get(storeId)
  if (!store) throw new ConvexError("STORE_ACCESS_DENIED")
  return { user, membership, store }
}
