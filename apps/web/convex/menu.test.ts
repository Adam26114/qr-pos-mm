import { expect, test } from "vitest"
import { api } from "./_generated/api"
import { backend, authenticate } from "../test/convex"

test("owner maintains verbatim menu content, a final whole-MMK price and availability", async () => {
  const t = backend()
  const owner = await authenticate(t, "menu-owner@example.com")
  const storeId = await owner.mutation(api.stores.create, { name: "Menu Cafe" })
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
    available: true,
    photoId: null,
  })
  expect(await owner.query(api.menu.manage, { storeId })).toMatchObject({
    categories: [{ _id: categoryId, name: "ကော်ဖီ Coffee" }],
    items: [
      {
        _id: itemId,
        name: "လက်ဖက်ရည် Tea",
        description: "နို့ပါသည် · With milk",
        price: 2500,
        available: true,
        signature: false,
        removedAt: null,
        photoUrl: null,
      },
    ],
  })
  await owner.mutation(api.menu.saveItem, {
    storeId,
    itemId,
    categoryId,
    name: "လက်ဖက်ရည် Tea",
    description: "နို့ပါသည် · With milk",
    price: 3000,
    available: false,
    photoId: null,
  })
  expect(await owner.query(api.menu.manage, { storeId })).toMatchObject({
    items: [{ _id: itemId, price: 3000, available: false }],
  })
})

test("owners select multiple signature items and omitted updates preserve their selection", async () => {
  const t = backend()
  const owner = await authenticate(t, "signature-owner@example.com")
  const storeId = await owner.mutation(api.stores.create, { name: "Parison" })
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "Coffee",
  })
  const values = {
    storeId,
    categoryId,
    name: "Parison coffee",
    description: "",
    price: 3000,
    available: true,
    photoId: null,
  }
  const first = await owner.mutation(api.menu.saveItem, {
    ...values,
    signature: true,
  })
  const second = await owner.mutation(api.menu.saveItem, {
    ...values,
    name: "Parison cold brew",
    signature: true,
  })
  const ordinary = await owner.mutation(api.menu.saveItem, {
    ...values,
    name: "Americano",
  })
  expect(
    (await owner.query(api.menu.manage, { storeId })).items
      .filter((item) => item.signature)
      .map((item) => item._id)
  ).toEqual([first, second])
  expect(await t.run((ctx) => ctx.db.get(ordinary))).toMatchObject({
    signature: false,
  })

  // Older clients omit signature when saving other menu fields.
  await owner.mutation(api.menu.saveItem, {
    ...values,
    itemId: first,
    price: 3500,
    available: false,
  })
  expect(await t.run((ctx) => ctx.db.get(first))).toMatchObject({
    signature: true,
    price: 3500,
    available: false,
  })
  await owner.mutation(api.menu.saveItem, {
    ...values,
    itemId: first,
    signature: false,
  })
  expect(
    (await owner.query(api.menu.view, { storeId })).items.find(
      (item) => item._id === first
    )
  ).toMatchObject({ signature: false })
  expect(
    (await owner.query(api.menu.view, { storeId })).items.find(
      (item) => item._id === second
    )
  ).toMatchObject({ signature: true })
})

test("legacy menu records read as ordinary items and can be edited without a backfill", async () => {
  const t = backend()
  const owner = await authenticate(t, "legacy-menu@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Legacy Cafe",
  })
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "Drinks",
  })
  const values = {
    storeId,
    categoryId,
    name: "Tea",
    description: "",
    price: 1000,
    available: true,
    photoId: null,
  }
  const itemId = await t.run((ctx) => ctx.db.insert("menuItems", values))
  expect(await t.run((ctx) => ctx.db.get(itemId))).not.toHaveProperty(
    "signature"
  )
  expect(await owner.query(api.menu.manage, { storeId })).toMatchObject({
    items: [{ _id: itemId, signature: false }],
  })
  expect(await owner.query(api.menu.view, { storeId })).toMatchObject({
    items: [{ _id: itemId, signature: false }],
  })
  await owner.mutation(api.menu.saveItem, { ...values, itemId, price: 1200 })
  expect(await t.run((ctx) => ctx.db.get(itemId))).toMatchObject({
    signature: false,
    price: 1200,
  })
})

test("removing offerings preserves their identifiers and prevents selling or editing removed items", async () => {
  const t = backend()
  const owner = await authenticate(t, "archive-owner@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Archive Cafe",
  })
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "Drinks",
  })
  const values = {
    storeId,
    categoryId,
    name: "Tea",
    description: "",
    price: 1000,
    available: true,
    signature: true,
    photoId: null,
  }
  const itemId = await owner.mutation(api.menu.saveItem, values)
  await expect(
    owner.mutation(api.menu.removeCategory, { storeId, categoryId })
  ).rejects.toThrow("CATEGORY_IN_USE")
  await owner.mutation(api.menu.removeItem, { storeId, itemId })
  await owner.mutation(api.menu.removeItem, { storeId, itemId })
  const menu = await owner.query(api.menu.manage, { storeId })
  expect(menu.items[0]).toMatchObject({
    _id: itemId,
    name: "Tea",
    price: 1000,
    available: false,
    signature: true,
  })
  expect(menu.items[0]!.removedAt).toEqual(expect.any(Number))
  await expect(
    owner.mutation(api.menu.saveItem, { ...values, itemId, signature: false })
  ).rejects.toThrow("MENU_ITEM_REMOVED")
  await owner.mutation(api.menu.removeCategory, { storeId, categoryId })
  expect(
    (await owner.query(api.menu.manage, { storeId })).categories[0]!.removedAt
  ).toEqual(expect.any(Number))
  await expect(owner.mutation(api.menu.saveItem, values)).rejects.toThrow(
    "CATEGORY_REMOVED"
  )
})

test("guests, staff and another store cannot modify menus or mix store references", async () => {
  const t = backend()
  const owner = await authenticate(t, "first-menu@example.com")
  const other = await authenticate(t, "other-menu@example.com")
  const staff = await authenticate(t, "staff-menu@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "First Cafe",
  })
  const otherStore = await other.mutation(api.stores.create, {
    name: "Other Cafe",
  })
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "Drinks",
  })
  const otherCategory = await other.mutation(api.menu.saveCategory, {
    storeId: otherStore,
    name: "Food",
  })
  const values = {
    storeId,
    categoryId,
    name: "Tea",
    description: "",
    price: 1000,
    available: true,
    photoId: null,
  }
  const itemId = await owner.mutation(api.menu.saveItem, values)
  const user = await staff.query(api.auth.getAuthUser)
  await t.run((ctx) =>
    ctx.db.insert("memberships", { userId: user._id, storeId, role: "staff" })
  )
  for (const [actor, expected] of [
    [t, "Unauthenticated"],
    [staff, "OWNER_REQUIRED"],
    [other, "STORE_ACCESS_DENIED"],
  ] as const) {
    await expect(
      actor.mutation(api.menu.saveCategory, { storeId, name: "Denied" })
    ).rejects.toThrow(expected)
    await expect(actor.mutation(api.menu.saveItem, values)).rejects.toThrow(
      expected
    )
    await expect(
      actor.mutation(api.menu.saveItem, { ...values, itemId, signature: true })
    ).rejects.toThrow(expected)
    await expect(
      actor.mutation(api.menu.removeItem, { storeId, itemId })
    ).rejects.toThrow(expected)
    await expect(
      actor.mutation(api.menu.removeCategory, { storeId, categoryId })
    ).rejects.toThrow(expected)
    await expect(actor.query(api.menu.manage, { storeId })).rejects.toThrow(
      expected
    )
  }
  await expect(
    owner.mutation(api.menu.saveItem, { ...values, categoryId: otherCategory })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  await expect(
    other.mutation(api.menu.saveItem, {
      ...values,
      storeId: otherStore,
      categoryId: otherCategory,
      itemId,
      signature: true,
    })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  for (const price of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])
    await expect(
      owner.mutation(api.menu.saveItem, { ...values, price })
    ).rejects.toThrow("INVALID_PRICE")
  for (const name of ["   ", "n".repeat(121)])
    await expect(
      owner.mutation(api.menu.saveItem, { ...values, name })
    ).rejects.toThrow("INVALID_MENU_NAME")
  expect(await staff.query(api.menu.view, { storeId })).toMatchObject({
    items: [{ name: "Tea", price: 1000, signature: false }],
  })
  await expect(other.query(api.menu.view, { storeId })).rejects.toThrow(
    "STORE_ACCESS_DENIED"
  )
  await expect(t.query(api.menu.view, { storeId })).rejects.toThrow(
    "Unauthenticated"
  )
})

test("photo uploads are authenticated, checked and bound to the uploading store", async () => {
  const t = backend()
  const owner = await authenticate(t, "photo-owner@example.com")
  const other = await authenticate(t, "other-photo@example.com")
  const storeId = await owner.mutation(api.stores.create, {
    name: "Photo Cafe",
  })
  const otherStore = await other.mutation(api.stores.create, {
    name: "Other Photo Cafe",
  })
  const png = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII="
    ),
    (char) => char.charCodeAt(0)
  )
  const upload = (
    actor: typeof owner,
    bytes: Uint8Array,
    type = "image/png",
    target = storeId
  ) =>
    actor.fetch(`/menu-photo?storeId=${target}`, {
      method: "POST",
      headers: { "Content-Type": type },
      body: new Blob([bytes as Uint8Array<ArrayBuffer>], { type }),
    })
  const staff = await authenticate(t, "photo-staff@example.com")
  const staffUser = await staff.query(api.auth.getAuthUser)
  await t.run((ctx) =>
    ctx.db.insert("memberships", {
      userId: staffUser._id,
      storeId,
      role: "staff",
    })
  )
  expect((await upload(staff, png)).status).toBe(403)
  expect((await upload(t, png)).status).toBe(401)
  expect((await upload(other, png)).status).toBe(403)
  expect(
    (await upload(owner, new TextEncoder().encode("<script>bad</script>")))
      .status
  ).toBe(400)
  expect((await upload(owner, png, "image/svg+xml")).status).toBe(400)
  expect(
    (await upload(owner, new Uint8Array(5 * 1024 * 1024 + 1))).status
  ).toBe(413)
  const response = await upload(owner, png)
  expect(response.status).toBe(200)
  const { photoId } = await response.json()
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "Drinks",
  })
  const itemId = await owner.mutation(api.menu.saveItem, {
    storeId,
    categoryId,
    name: "Tea",
    description: "",
    price: 1000,
    available: true,
    photoId,
  })
  const item = (await owner.query(api.menu.manage, { storeId })).items[0]!
  expect(item).toMatchObject({ _id: itemId, photoId })
  expect(item.photoUrl).toMatch(/^https?:\/\//)
  const otherCategory = await other.mutation(api.menu.saveCategory, {
    storeId: otherStore,
    name: "Food",
  })
  await expect(
    other.mutation(api.menu.saveItem, {
      storeId: otherStore,
      categoryId: otherCategory,
      name: "Stolen",
      description: "",
      price: 1000,
      available: true,
      photoId,
    })
  ).rejects.toThrow("INVALID_PHOTO")
  await owner.mutation(api.menu.saveItem, {
    storeId,
    itemId,
    categoryId,
    name: "Tea",
    description: "",
    price: 1000,
    available: true,
    photoId: null,
  })
  expect(
    (await owner.query(api.menu.manage, { storeId })).items[0]!.photoUrl
  ).toBeNull()
})
