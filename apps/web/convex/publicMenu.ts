import { v } from "convex/values"
import { query } from "./_generated/server"

// This projection is deliberately public. Never spread private store/menu records here.
export const read = query({
  args: { storeId: v.string() },
  handler: async (ctx, args) => {
    const storeId = ctx.db.normalizeId("stores", args.storeId)
    const store = storeId ? await ctx.db.get(storeId) : null
    if (!store || !storeId) return null
    const [categories, items, tables] = await Promise.all([
      ctx.db
        .query("menuCategories")
        .withIndex("by_store", (q) => q.eq("storeId", storeId))
        .collect(),
      ctx.db
        .query("menuItems")
        .withIndex("by_store", (q) => q.eq("storeId", storeId))
        .collect(),
      ctx.db
        .query("tables")
        .withIndex("by_store", (q) => q.eq("storeId", storeId))
        .collect(),
    ])
    const activeCategories = categories.filter(
      (category) => category.removedAt === undefined
    )
    const categoryIds = new Set(
      activeCategories.map((category) => category._id)
    )
    return {
      store: { _id: store._id, name: store.name },
      categories: activeCategories.map(({ _id, name }) => ({ _id, name })),
      items: await Promise.all(
        items
          .filter(
            (item) =>
              item.removedAt === undefined && categoryIds.has(item.categoryId)
          )
          .map(async (item) => {
            const photo = item.photoId ? await ctx.db.get(item.photoId) : null
            return {
              _id: item._id,
              categoryId: item.categoryId,
              name: item.name,
              description: item.description,
              price: item.price,
              available: item.available,
              signature: item.signature ?? false,
              photoUrl:
                photo?.storeId === storeId
                  ? await ctx.storage.getUrl(photo.storageId)
                  : null,
            }
          })
      ),
      tables: tables
        .filter((table) => table.removedAt === undefined)
        .sort((a, b) => a.number - b.number)
        .map(({ _id, number }) => ({ _id, number })),
    }
  },
})
