import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"
import {
  requireStoreMembership,
  requireStoreOwner,
  storeEntitlement,
} from "./lib/store_access"

export const list = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, { storeId }) => {
    const { store } = await requireStoreMembership(ctx, storeId)
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .collect()
    return {
      tables: tables
        .filter((table) => table.removedAt === undefined)
        .sort((a, b) => a.number - b.number),
      acceptingOrders: storeEntitlement(store).active,
    }
  },
})
export const add = mutation({
  args: { storeId: v.id("stores"), number: v.number() },
  handler: async (ctx, { storeId, number }) => {
    await requireStoreOwner(ctx, storeId)
    if (!Number.isSafeInteger(number) || number < 1 || number > 9999)
      throw new ConvexError("INVALID_TABLE")
    const tables = await ctx.db
      .query("tables")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .collect()
    if (
      tables.some(
        (table) => table.number === number && table.removedAt === undefined
      )
    )
      throw new ConvexError("TABLE_EXISTS")
    return await ctx.db.insert("tables", { storeId, number })
  },
})
export const remove = mutation({
  args: { storeId: v.id("stores"), tableId: v.id("tables") },
  handler: async (ctx, { storeId, tableId }) => {
    await requireStoreOwner(ctx, storeId)
    const table = await ctx.db.get(tableId)
    if (!table || table.storeId !== storeId)
      throw new ConvexError("STORE_ACCESS_DENIED")
    if (table.removedAt === undefined)
      await ctx.db.patch(tableId, { removedAt: Date.now() })
  },
})
