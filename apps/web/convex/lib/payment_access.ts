import { ConvexError, v } from "convex/values"
import type { QueryCtx } from "../_generated/server"
import type { Doc } from "../_generated/dataModel"
import { requireStoreMembership } from "./store_access"

export async function hashToken(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
    ),
    (b) => b.toString(16).padStart(2, "0")
  ).join("")
}
export const paymentAccess = v.union(
  v.object({ token: v.string() }),
  v.object({ storeId: v.id("stores"), orderId: v.id("orders") })
)
export async function paymentOrder(
  ctx: QueryCtx,
  access:
    | { token: string }
    | { storeId: Doc<"stores">["_id"]; orderId: Doc<"orders">["_id"] }
) {
  if ("token" in access) {
    if (!/^[a-f0-9]{64}$/.test(access.token))
      throw new ConvexError("ORDER_ACCESS_DENIED")
    const tokenHash = await hashToken(access.token)
    const receipt = await ctx.db
      .query("guestReceipts")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique()
    const order = receipt ? await ctx.db.get(receipt.orderId) : null
    if (!receipt || !order || order.storeId !== receipt.storeId)
      throw new ConvexError("ORDER_ACCESS_DENIED")
    return order
  }
  await requireStoreMembership(ctx, access.storeId)
  const order = await ctx.db.get(access.orderId)
  if (!order || order.storeId !== access.storeId)
    throw new ConvexError("STORE_ACCESS_DENIED")
  return order
}
