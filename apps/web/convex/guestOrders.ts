import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { orderLineInput, snapshotOrderLines } from "./lib/order_lines"
import { assertAcceptingOrders, storeEntitlement } from "./lib/store_access"

async function hashToken(token: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  )
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  )
}
const validToken = (token: string) => /^[a-f0-9]{64}$/.test(token)

export const accepting = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, { storeId }) => {
    const store = await ctx.db.get(storeId)
    return !!store && storeEntitlement(store).active
  },
})

export const submit = mutation({
  args: {
    storeId: v.id("stores"),
    token: v.string(),
    tableId: v.id("tables"),
    lines: v.array(orderLineInput),
    note: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validToken(args.token)) throw new ConvexError("INVALID_ORDER")
    const tokenHash = await hashToken(args.token)
    const payload = JSON.stringify({
      storeId: args.storeId,
      tableId: args.tableId,
      lines: [...args.lines].sort((a, b) => a.itemId.localeCompare(b.itemId)),
      note: args.note,
    })
    const receipt = await ctx.db
      .query("guestReceipts")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique()
    if (receipt) {
      const order = await ctx.db.get(receipt.orderId)
      if (!order || order.payload !== payload)
        throw new ConvexError("SUBMISSION_KEY_REUSED")
      return order._id
    }
    const store = await ctx.db.get(args.storeId)
    if (!store) throw new ConvexError("STORE_ACCESS_DENIED")
    assertAcceptingOrders(store)
    const table = await ctx.db.get(args.tableId)
    if (!table || table.storeId !== args.storeId)
      throw new ConvexError("INVALID_TABLE")
    if (table.removedAt !== undefined) throw new ConvexError("TABLE_REMOVED")
    const { lines, total } = await snapshotOrderLines(
      ctx,
      args.storeId,
      args.lines,
      args.note
    )
    const orderId = await ctx.db.insert("orders", {
      storeId: args.storeId,
      createdBy: "guest",
      submissionKey: tokenHash,
      payload,
      createdAt: Date.now(),
      source: "qr",
      lines,
      note: args.note,
      total,
      status: "pending",
      destination: { kind: "table", tableId: table._id, number: table.number },
    })
    await ctx.db.insert("guestReceipts", {
      storeId: args.storeId,
      tokenHash,
      orderId,
    })
    return orderId
  },
})

export const track = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (!validToken(token)) return null
    const tokenHash = await hashToken(token)
    const receipt = await ctx.db
      .query("guestReceipts")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .unique()
    const order = receipt ? await ctx.db.get(receipt.orderId) : null
    if (!receipt || !order || order.storeId !== receipt.storeId) return null
    const store = await ctx.db.get(receipt.storeId)
    if (!store) return null
    const payment = await ctx.db
      .query("cashPayments")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .unique()
    return {
      store: { _id: store._id, name: store.name },
      order: {
        _id: order._id,
        createdAt: order.createdAt,
        source: order.source,
        lines: order.lines,
        note: order.note,
        total: order.total,
        status: order.status,
        destination:
          order.destination?.kind === "table"
            ? { kind: "table" as const, number: order.destination.number }
            : null,
      },
      paid: !!payment,
    }
  },
})
