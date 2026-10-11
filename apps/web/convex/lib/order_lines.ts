import { ConvexError, v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"

export const orderLineInput = v.object({
  itemId: v.id("menuItems"),
  quantity: v.number(),
  expectedPrice: v.number(),
})

// Capture authored values at acceptance; later menu edits never alter an existing bill.
export async function snapshotOrderLines(
  ctx: QueryCtx,
  storeId: Id<"stores">,
  input: { itemId: Id<"menuItems">; quantity: number; expectedPrice: number }[],
  note: string
) {
  if (!input.length || input.length > 100 || note.length > 2000)
    throw new ConvexError("INVALID_ORDER")
  const ids = new Set<string>()
  const lines = []
  let total = 0
  for (const line of input) {
    if (
      ids.has(line.itemId) ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 99
    )
      throw new ConvexError("INVALID_ORDER")
    ids.add(line.itemId)
    const item = await ctx.db.get(line.itemId)
    if (!item || item.storeId !== storeId)
      throw new ConvexError("STORE_ACCESS_DENIED")
    const category = await ctx.db.get(item.categoryId)
    if (
      item.removedAt !== undefined ||
      !item.available ||
      !category ||
      category.storeId !== storeId ||
      category.removedAt !== undefined
    )
      throw new ConvexError("ITEM_UNAVAILABLE")
    if (item.price !== line.expectedPrice)
      throw new ConvexError("PRICE_CHANGED")
    total += item.price * line.quantity
    if (!Number.isSafeInteger(total) || total < 1)
      throw new ConvexError("INVALID_ORDER")
    lines.push({
      itemId: item._id,
      name: item.name,
      unitPrice: item.price,
      quantity: line.quantity,
    })
  }
  return { lines, total }
}
