import { ConvexError, v } from "convex/values"
import { mutation, query } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import type { QueryCtx } from "./_generated/server"
import { requireStoreMembership, requireStoreOwner } from "./lib/store_access"

function validateName(name: string) {
  if (!name.trim() || name.length > 120)
    throw new ConvexError("INVALID_MENU_NAME")
}

export const saveCategory = mutation({
  args: {
    storeId: v.id("stores"),
    categoryId: v.optional(v.id("menuCategories")),
    name: v.string(),
  },
  returns: v.id("menuCategories"),
  handler: async (ctx, { storeId, categoryId, name }) => {
    await requireStoreOwner(ctx, storeId)
    validateName(name)
    if (categoryId) {
      const category = await ctx.db.get(categoryId)
      if (!category || category.storeId !== storeId)
        throw new ConvexError("STORE_ACCESS_DENIED")
      if (category.removedAt !== undefined)
        throw new ConvexError("CATEGORY_REMOVED")
      await ctx.db.patch(categoryId, { name })
      return categoryId
    }
    return await ctx.db.insert("menuCategories", { storeId, name })
  },
})

export const saveItem = mutation({
  args: {
    storeId: v.id("stores"),
    itemId: v.optional(v.id("menuItems")),
    categoryId: v.id("menuCategories"),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    available: v.boolean(),
    signature: v.optional(v.boolean()),
    photoId: v.union(v.id("menuPhotos"), v.null()),
  },
  returns: v.id("menuItems"),
  handler: async (ctx, { storeId, itemId, signature, ...values }) => {
    await requireStoreOwner(ctx, storeId)
    validateName(values.name)
    if (values.description.length > 2000)
      throw new ConvexError("INVALID_DESCRIPTION")
    if (!Number.isSafeInteger(values.price) || values.price <= 0)
      throw new ConvexError("INVALID_PRICE")
    const category = await ctx.db.get(values.categoryId)
    if (!category || category.storeId !== storeId)
      throw new ConvexError("STORE_ACCESS_DENIED")
    if (category.removedAt !== undefined)
      throw new ConvexError("CATEGORY_REMOVED")
    if (values.photoId) {
      const photo = await ctx.db.get(values.photoId)
      if (
        !photo ||
        photo.storeId !== storeId ||
        !(await ctx.db.system.get(photo.storageId))
      )
        throw new ConvexError("INVALID_PHOTO")
    }
    if (itemId) {
      const item = await ctx.db.get(itemId)
      if (!item || item.storeId !== storeId)
        throw new ConvexError("STORE_ACCESS_DENIED")
      if (item.removedAt !== undefined)
        throw new ConvexError("MENU_ITEM_REMOVED")
      await ctx.db.patch(itemId, {
        ...values,
        signature: signature ?? item.signature ?? false,
      })
      return itemId
    }
    return await ctx.db.insert("menuItems", {
      storeId,
      ...values,
      signature: signature ?? false,
    })
  },
})

async function readMenu(ctx: QueryCtx, storeId: Id<"stores">) {
  const categories = await ctx.db
    .query("menuCategories")
    .withIndex("by_store", (q) => q.eq("storeId", storeId))
    .collect()
  const items = await ctx.db
    .query("menuItems")
    .withIndex("by_store", (q) => q.eq("storeId", storeId))
    .collect()
  return {
    categories: categories.map((category) => ({
      ...category,
      removedAt: category.removedAt ?? null,
    })),
    items: await Promise.all(
      items.map(async (item) => {
        const photo = item.photoId ? await ctx.db.get(item.photoId) : null
        return {
          ...item,
          signature: item.signature ?? false,
          removedAt: item.removedAt ?? null,
          photoUrl:
            photo?.storeId === storeId
              ? await ctx.storage.getUrl(photo.storageId)
              : null,
        }
      })
    ),
  }
}

export const manage = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, { storeId }) => {
    await requireStoreOwner(ctx, storeId)
    return await readMenu(ctx, storeId)
  },
})

export const view = query({
  args: { storeId: v.id("stores") },
  handler: async (ctx, { storeId }) => {
    await requireStoreMembership(ctx, storeId)
    const menu = await readMenu(ctx, storeId)
    return {
      categories: menu.categories.filter(
        (category) => category.removedAt === null
      ),
      items: menu.items.filter((item) => item.removedAt === null),
    }
  },
})

export const removeItem = mutation({
  args: { storeId: v.id("stores"), itemId: v.id("menuItems") },
  returns: v.null(),
  handler: async (ctx, { storeId, itemId }) => {
    await requireStoreOwner(ctx, storeId)
    const item = await ctx.db.get(itemId)
    if (!item || item.storeId !== storeId)
      throw new ConvexError("STORE_ACCESS_DENIED")
    if (item.removedAt === undefined)
      await ctx.db.patch(itemId, { removedAt: Date.now(), available: false })
    return null
  },
})

export const removeCategory = mutation({
  args: { storeId: v.id("stores"), categoryId: v.id("menuCategories") },
  returns: v.null(),
  handler: async (ctx, { storeId, categoryId }) => {
    await requireStoreOwner(ctx, storeId)
    const category = await ctx.db.get(categoryId)
    if (!category || category.storeId !== storeId)
      throw new ConvexError("STORE_ACCESS_DENIED")
    const items = await ctx.db
      .query("menuItems")
      .withIndex("by_category", (q) => q.eq("categoryId", categoryId))
      .collect()
    if (items.some((item) => item.removedAt === undefined))
      throw new ConvexError("CATEGORY_IN_USE")
    if (category.removedAt === undefined)
      await ctx.db.patch(categoryId, { removedAt: Date.now() })
    return null
  },
})
