import { expect, test } from "vitest"
import { api } from "./_generated/api"
import { authenticate, backend } from "../test/convex"

test("a logged-out guest sees only public menu and active tables for the requested store", async () => {
  const t = backend()
  const owner = await authenticate(t, "public-menu@example.com")
  const storeId = await owner.mutation(api.stores.create, { name: "ကဖေး Cafe" })
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "ကော်ဖီ Coffee",
  })
  const itemId = await owner.mutation(api.menu.saveItem, {
    storeId,
    categoryId,
    name: "လက်ဖက်ရည် Tea",
    description: "နို့ပါသည် · With milk",
    price: 2500,
    available: false,
    photoId: null,
  })
  const tableId = await owner.mutation(api.tables.add, { storeId, number: 4 })
  const removedTable = await owner.mutation(api.tables.add, {
    storeId,
    number: 8,
  })
  await owner.mutation(api.tables.remove, { storeId, tableId: removedTable })
  const other = await authenticate(t, "other-public-menu@example.com")
  const otherStore = await other.mutation(api.stores.create, {
    name: "Other Cafe",
  })
  const otherCategory = await other.mutation(api.menu.saveCategory, {
    storeId: otherStore,
    name: "Other food",
  })
  await other.mutation(api.menu.saveItem, {
    storeId: otherStore,
    categoryId: otherCategory,
    name: "Other item",
    description: "Private to this menu",
    price: 9000,
    available: true,
    photoId: null,
  })
  expect(await t.query(api.publicMenu.read, { storeId })).toEqual({
    store: { _id: storeId, name: "ကဖေး Cafe" },
    categories: [{ _id: categoryId, name: "ကော်ဖီ Coffee" }],
    items: [
      {
        _id: itemId,
        categoryId,
        name: "လက်ဖက်ရည် Tea",
        description: "နို့ပါသည် · With milk",
        price: 2500,
        available: false,
        photoUrl: null,
      },
    ],
    tables: [{ _id: tableId, number: 4 }],
  })
  expect(
    await t.query(api.publicMenu.read, { storeId: otherStore })
  ).toMatchObject({
    store: { name: "Other Cafe" },
    items: [{ name: "Other item" }],
  })
  expect(
    await t.query(api.publicMenu.read, { storeId: "invalid-link" })
  ).toBeNull()
})

test("the guest menu reflects photos, final price changes and removal without exposing photo ownership", async () => {
  const t = backend()
  const owner = await authenticate(t, "live-public-menu@example.com")
  const storeId = await owner.mutation(api.stores.create, { name: "Live Cafe" })
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "Food",
  })
  const response = await owner.fetch(`/menu-photo?storeId=${storeId}`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: new Blob(
      [
        Uint8Array.from(
          atob(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII="
          ),
          (char) => char.charCodeAt(0)
        ),
      ],
      { type: "image/png" }
    ),
  })
  expect(response.status).toBe(200)
  const { photoId } = await response.json()
  const item = {
    storeId,
    categoryId,
    name: "မုန့် Toast",
    description: "With butter",
    price: 1500,
    available: true,
    photoId,
  }
  const itemId = await owner.mutation(api.menu.saveItem, item)
  const menu = await t.query(api.publicMenu.read, { storeId })
  expect(menu!.items).toEqual([
    {
      _id: itemId,
      categoryId,
      name: "မုန့် Toast",
      description: "With butter",
      price: 1500,
      available: true,
      photoUrl: expect.stringMatching(/^https?:\/\//),
    },
  ])
  await owner.mutation(api.menu.saveItem, {
    ...item,
    itemId,
    price: 2000,
    available: false,
  })
  expect(
    (await t.query(api.publicMenu.read, { storeId }))!.items[0]
  ).toMatchObject({ price: 2000, available: false })
  await owner.mutation(api.menu.removeItem, { storeId, itemId })
  await owner.mutation(api.menu.removeCategory, { storeId, categoryId })
  expect(await t.query(api.publicMenu.read, { storeId })).toEqual({
    store: { _id: storeId, name: "Live Cafe" },
    categories: [],
    items: [],
    tables: [],
  })
  expect(await t.query(api.publicMenu.read, { storeId: categoryId })).toBeNull()
})
