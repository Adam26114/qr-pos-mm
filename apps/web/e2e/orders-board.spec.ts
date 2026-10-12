import { expect, test } from "@playwright/test"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { createGuestCafe } from "./helpers/guest-cafe"

test("order board preserves live dialogs, responsive status selection, and paginated history", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 960 })
  await createGuestCafe(page)
  // Bulk fixtures use authenticated public operations on the guarded local test backend.
  const response = await page.request.get("/api/auth/convex/token")
  expect(response.ok()).toBe(true)
  const { token } = await response.json()
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  client.setAuth(token)
  const workspace = await client.query(api.stores.workspace, {})
  const storeId = workspace.store!._id
  const menu = await client.query(api.menu.manage, { storeId })
  const tables = await client.query(api.tables.list, { storeId })
  const item = menu.items[0]!
  const tableId = tables.tables[0]!._id
  const lines = [{ itemId: item._id, quantity: 1, expectedPrice: item.price }]
  const guestOrder = (note: string) =>
    client.mutation(api.guestOrders.submit, {
      storeId,
      tableId,
      lines,
      note,
      token:
        crypto.randomUUID().replaceAll("-", "") +
        crypto.randomUUID().replaceAll("-", ""),
    })
  for (let index = 0; index < 21; index++) {
    const orderId = await guestOrder(
      `History ${String(index).padStart(2, "0")}`
    )
    const command = { storeId, orderId }
    await client.mutation(api.orders.startCooking, command)
    await client.mutation(api.orders.markServed, command)
    await client.mutation(api.orders.recordCash, command)
  }
  const longName = "လက်ဖက်ရည် Tea " + "Long menu item ".repeat(6)
  const expensive = await client.mutation(api.menu.saveItem, {
    storeId,
    categoryId: item.categoryId,
    name: longName,
    description: "",
    price: 987654321000,
    available: true,
    photoId: null,
  })
  const pending = await guestOrder("Ready to cook · သကြားမပါ")
  const cooking = await guestOrder("Cooking order")
  await client.mutation(api.orders.startCooking, { storeId, orderId: cooking })
  const awaiting = await guestOrder("Awaiting payment")
  await client.mutation(api.orders.startCooking, { storeId, orderId: awaiting })
  await client.mutation(api.orders.markServed, { storeId, orderId: awaiting })
  const unpaid = await client.mutation(api.orders.createCounter, {
    storeId,
    submissionKey: crypto.randomUUID(),
    lines: [{ itemId: expensive, quantity: 99, expectedPrice: 987654321000 }],
    note: "Long note " + "အော်ဒါမှတ်ချက်".repeat(15),
  })
  const unassigned = await client.mutation(api.orders.createCounter, {
    storeId,
    submissionKey: crypto.randomUUID(),
    lines,
    note: "Paid, needs destination",
  })
  await client.mutation(api.orders.recordCash, { storeId, orderId: unassigned })
  const ready = await client.mutation(api.orders.createCounter, {
    storeId,
    submissionKey: crypto.randomUUID(),
    lines,
    note: "Ready counter",
  })
  await client.mutation(api.orders.recordCash, { storeId, orderId: ready })
  await client.mutation(api.orders.assignDestination, {
    storeId,
    orderId: ready,
    destination: { kind: "takeaway" },
  })
  await page.goto("/workspace/orders")
  const queue = page.getByRole("region", { name: "Live orders", exact: true })
  await expect(queue.getByRole("article")).toHaveCount(6)
  await expect(
    queue.getByRole("heading", { name: "Pending 4", exact: true })
  ).toBeVisible()
  await expect(
    queue.getByRole("heading", { name: "Cooking 1", exact: true })
  ).toBeVisible()
  await expect(
    queue.getByRole("heading", { name: "Awaiting cash 1", exact: true })
  ).toBeVisible()
  const ticket = (orderId: string) => page.locator(`#order-${orderId}`)
  await expect(
    ticket(unpaid).getByRole("button", {
      name: "Payment received",
      exact: true,
    })
  ).toBeVisible()
  await expect(
    ticket(unpaid).getByRole("button", { name: "Start cooking", exact: true })
  ).toHaveCount(0)
  await expect(
    ticket(unassigned).getByRole("button", {
      name: "Assign destination",
      exact: true,
    })
  ).toBeVisible()
  await expect(
    ticket(ready).getByRole("button", { name: "Start cooking", exact: true })
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/orders-board-desktop.png",
    fullPage: true,
  })
  const more = ticket(pending).getByRole("button", { name: /^Order actions:/ })
  await more.focus()
  await more.press("Enter")
  const historyItem = page.getByRole("menuitem", {
    name: "Order history",
    exact: true,
  })
  await historyItem.press("Enter")
  const history = page.getByRole("dialog", {
    name: "Order history",
    exact: true,
  })
  await expect(history).toBeVisible()
  expect(
    await history.evaluate(
      (element) => getComputedStyle(element).transitionDuration
    )
  ).toBe("0s")
  await client.mutation(api.orders.startCooking, { storeId, orderId: pending })
  await expect(
    history.getByRole("article").getByText("Cooking", { exact: true })
  ).toBeVisible()
  await history.getByRole("button", { name: "Close", exact: true }).click()
  await expect(page.locator("#orders-lane-pending")).toBeFocused()
  await expect(
    queue.getByRole("heading", { name: "Cooking 2", exact: true })
  ).toBeVisible()
  await ticket(awaiting)
    .getByRole("button", { name: "Payment received", exact: true })
    .click()
  const cash = page.getByRole("alertdialog")
  await expect(cash).toBeVisible()
  await client.mutation(api.orders.recordCash, { storeId, orderId: awaiting })
  await expect(cash.getByText("Cash received", { exact: true })).toBeVisible()
  await expect(
    cash.getByRole("button", { name: "Payment received", exact: true })
  ).toBeDisabled()
  await cash.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.locator("#orders-lane-served")).toBeFocused()
  await expect(ticket(awaiting)).toHaveCount(0)

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(
      queue.getByRole("tab", { name: "Pending (3)", exact: true })
    ).toHaveAttribute("aria-selected", "true")
    await expect(
      ticket(unpaid).getByText(longName, { exact: false })
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.getByRole("button", { name: "မြန်မာ", exact: true }).click()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: `test-results/orders-board-mobile-my-${width}.png`,
      fullPage: true,
    })
    await page.keyboard.press("d")
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.keyboard.press("d")
    await page.getByRole("button", { name: "English", exact: true }).click()
  }
  const cookingTab = queue.getByRole("tab", {
    name: "Cooking (2)",
    exact: true,
  })
  await cookingTab.focus()
  await cookingTab.press("Enter")
  await expect(queue.getByRole("article")).toHaveCount(2)
  await guestOrder("Fresh while viewing cooking")
  await expect(
    queue.getByRole("tab", { name: "Pending (4)", exact: true })
  ).toBeVisible()
  await expect(cookingTab).toHaveAttribute("aria-selected", "true")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await ticket(cooking)
    .getByRole("button", { name: /^Order actions:/ })
    .click()
  expect(
    await page
      .getByRole("menu")
      .evaluate((element) => getComputedStyle(element).transitionDuration)
  ).toBe("0s")
  await page
    .getByRole("menuitem", { name: "Order history", exact: true })
    .press("Escape")

  await page.setViewportSize({ width: 1440, height: 960 })
  await page
    .getByRole("button", { name: "Toggle sidebar", exact: true })
    .click()
  await expect(
    queue.getByRole("heading", { name: "Pending 4", exact: true })
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true)
  await page.getByRole("tab", { name: "History", exact: true }).click()
  const served = page.getByRole("region", {
    name: "History",
    exact: true,
  })
  await expect(served.getByRole("article")).toHaveCount(20)
  await expect(served.getByText("History 00", { exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Load more", exact: true }).click()
  await expect(served.getByRole("article")).toHaveCount(22)
  await expect(served.getByText("History 00", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Load more", exact: true })
  ).toHaveCount(0)
})
