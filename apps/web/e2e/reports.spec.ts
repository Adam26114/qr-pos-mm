import { expect, test } from "@playwright/test"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { createGuestCafe } from "./helpers/guest-cafe"

test("owner reports reconcile live money, retain current unpaid bills and open traceable readonly details", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.emulateMedia({ colorScheme: "light" })
  await page.setViewportSize({ width: 1440, height: 960 })
  await createGuestCafe(page)
  const { token } = await (
    await page.request.get("/api/auth/convex/token")
  ).json()
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  client.setAuth(token)
  const workspace = await client.query(api.stores.workspace, {})
  const storeId = workspace.store!._id
  const menu = await client.query(api.menu.manage, { storeId })
  const item = menu.items[0]!
  const tables = await client.query(api.tables.list, { storeId })
  const create = () =>
    client.mutation(api.orders.createCounter, {
      storeId,
      submissionKey: crypto.randomUUID(),
      lines: [{ itemId: item._id, quantity: 1, expectedPrice: 2500 }],
      note: "Report bill",
    })
  const money = (name: string, amount: string) =>
    page
      .getByRole("region", { name, exact: true })
      .getByText(amount, { exact: true })
  await page.goto("/workspace")
  for (const name of ["Collected", "Refunded", "Net collected", "Unpaid now"])
    await expect(money(name, "0 MMK")).toBeVisible()
  const staffContext = await browser.newContext({ baseURL })
  try {
    const invitation = await client.action(api.staff.createJoinLink, {
      storeId,
    })
    const staff = await staffContext.newPage()
    await staff.goto(`/invite/${invitation.token}`)
    await staff.getByLabel("Your name", { exact: true }).fill("Report cashier")
    await staff
      .getByLabel("Email", { exact: true })
      .fill(`report-staff-${crypto.randomUUID()}@example.com`)
    await staff.getByLabel("Password", { exact: true }).fill("CafePassword42!")
    await staff
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await staff.getByRole("button", { name: "Join store", exact: true }).click()
    await expect(
      staff.getByRole("heading", { name: "Guest Cafe", exact: true })
    ).toBeVisible()
    await expect(
      staff.getByRole("region", { name: "Revenue reports", exact: true })
    ).toHaveCount(0)
    const staffToken = await (
      await staff.request.get("/api/auth/convex/token")
    ).json()
    const cashier = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
    cashier.setAuth(staffToken.token)
    await expect(
      cashier.query(api.reports.summary, {
        storeId,
        kind: "day",
        key: "2020-01-01",
      })
    ).rejects.toThrow("OWNER_REQUIRED")

    const first = await create()
    await expect(money("Unpaid now", "2,500 MMK")).toBeVisible()
    await cashier.mutation(api.orders.recordCash, { storeId, orderId: first })
    await expect(money("Collected", "2,500 MMK")).toBeVisible()
    await expect(money("Unpaid now", "0 MMK")).toBeVisible()
    const firstButton = page.getByRole("button", {
      name: `View order · ${first.slice(-6).toUpperCase()}`,
      exact: true,
    })
    await firstButton.click()
    const history = page.getByRole("dialog", {
      name: "Order history",
      exact: true,
    })
    await expect(
      history.getByText("လက်ဖက်ရည် Tea", { exact: false })
    ).toBeVisible()
    await expect(
      history.getByText(`cash:${first}`, { exact: false })
    ).toBeVisible()
    await expect(
      history.getByRole("button", { name: "Payment received", exact: true })
    ).toHaveCount(0)
    await history.getByRole("button", { name: "Close", exact: true }).click()
    await expect(firstButton).toBeFocused()
    await cashier.mutation(api.orders.assignDestination, {
      storeId,
      orderId: first,
      destination: { kind: "takeaway" },
    })
    await cashier.mutation(api.orders.startCooking, { storeId, orderId: first })
    await cashier.mutation(api.orders.markServed, { storeId, orderId: first })
    const detail = await client.query(api.orders.detail, {
      storeId,
      orderId: first,
    })
    await client.mutation(api.orders.recordRefund, {
      storeId,
      orderId: first,
      collectionId: detail.collections[0]!._id,
      requestKey: crypto.randomUUID(),
      reason: "Cash returned outside the app",
    })
    await expect(money("Refunded", "2,500 MMK")).toBeVisible()
    await expect(money("Net collected", "0 MMK")).toBeVisible()
    await page.getByRole("tab", { name: "Refunds", exact: true }).click()
    await firstButton.click()
    await expect(
      history.getByText("Cash returned outside the app", { exact: true })
    ).toBeVisible()
    await expect(
      history.getByRole("article").getByText("Served", { exact: true })
    ).toBeVisible()
    await history.getByRole("button", { name: "Close", exact: true }).click()

    const guestClient = new ConvexHttpClient(
      process.env.NEXT_PUBLIC_CONVEX_URL!
    )
    const seated = await guestClient.mutation(api.guestOrders.submit, {
      storeId,
      tableId: tables.tables[0]!._id,
      token:
        crypto.randomUUID().replaceAll("-", "") +
        crypto.randomUUID().replaceAll("-", ""),
      lines: [{ itemId: item._id, quantity: 1, expectedPrice: 2500 }],
      note: "Seated bill",
    })
    await cashier.mutation(api.orders.startCooking, {
      storeId,
      orderId: seated,
    })
    await cashier.mutation(api.orders.markServed, { storeId, orderId: seated })
    await page.getByLabel("Reporting day", { exact: true }).fill("2020-01-01")
    await expect(money("Collected", "0 MMK")).toBeVisible()
    await expect(money("Unpaid now", "2,500 MMK")).toBeVisible()
    await page.getByRole("tab", { name: "Unpaid orders", exact: true }).click()
    const seatedButton = page.getByRole("button", {
      name: `View order · ${seated.slice(-6).toUpperCase()}`,
      exact: true,
    })
    await seatedButton.click()
    await cashier.mutation(api.orders.recordCash, { storeId, orderId: seated })
    await expect(
      history.getByRole("article").getByText("Cash received", { exact: true })
    ).toBeVisible()
    await expect(history).toBeVisible()
    await history.getByRole("button", { name: "Close", exact: true }).click()
    await expect(money("Unpaid now", "0 MMK")).toBeVisible()
    await expect(page.locator("#reports-table-heading")).toBeFocused()
    await expect(page.getByLabel("Reporting day", { exact: true })).toHaveValue(
      "2020-01-01"
    )
    await page.getByRole("button", { name: "Today", exact: true }).click()
    await expect(money("Collected", "5,000 MMK")).toBeVisible()
    await page.getByRole("tab", { name: "Month", exact: true }).click()
    await page.getByLabel("Reporting month", { exact: true }).fill("2020-01")
    await expect(money("Refunded", "0 MMK")).toBeVisible()
    await page.getByRole("button", { name: "This month", exact: true }).click()
    await expect(money("Refunded", "2,500 MMK")).toBeVisible()
    await page.getByRole("tab", { name: "Day", exact: true }).click()

    for (let i = 0; i < 21; i++) {
      const orderId = await create()
      await cashier.mutation(api.orders.recordCash, { storeId, orderId })
    }
    await expect(money("Collected", "57,500 MMK")).toBeVisible()
    await page.getByRole("tab", { name: "Collections", exact: true }).click()
    await expect(page.locator('[data-testid^="report-row-"]')).toHaveCount(20)
    await page.getByRole("button", { name: "Load more", exact: true }).click()
    await expect(page.locator('[data-testid^="report-row-"]')).toHaveCount(23)
    await expect(
      page.getByRole("button", { name: "Load more", exact: true })
    ).toHaveCount(0)
    const longName = "Long menu item " + "x".repeat(60)
    const longItem = await client.mutation(api.menu.saveItem, {
      storeId,
      categoryId: item.categoryId,
      name: longName,
      description: "",
      price: 123456789,
      available: true,
      photoId: null,
    })
    const longBill = await guestClient.mutation(api.guestOrders.submit, {
      storeId,
      tableId: tables.tables[0]!._id,
      token:
        crypto.randomUUID().replaceAll("-", "") +
        crypto.randomUUID().replaceAll("-", ""),
      lines: [{ itemId: longItem, quantity: 1, expectedPrice: 123456789 }],
      note: "Long note · မြန်မာစာ ".repeat(35),
    })
    await page.getByRole("tab", { name: "Unpaid orders", exact: true }).click()
    await expect(money("Unpaid now", "123,456,789 MMK")).toBeVisible()
    await page.screenshot({
      path: "test-results/reports-desktop-light.png",
      fullPage: true,
    })
    await page
      .getByRole("button", { name: "Toggle sidebar", exact: true })
      .click()
    await page.getByRole("button", { name: "Account", exact: true }).click()
    await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menu")).toHaveCount(0)
    await page.screenshot({
      path: "test-results/reports-desktop-dark.png",
      fullPage: true,
    })
    await page
      .getByRole("button", {
        name: `View order · ${longBill.slice(-6).toUpperCase()}`,
        exact: true,
      })
      .click()
    await expect(history.getByText(longName, { exact: false })).toBeVisible()
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await history
        .getByRole("button", { name: "Close", exact: true })
        .scrollIntoViewIfNeeded()
      await expect(
        history.getByRole("button", { name: "Close", exact: true })
      ).toBeVisible()
    }
    await page.screenshot({
      path: "test-results/reports-detail-mobile.png",
      fullPage: true,
    })
    await history.getByRole("button", { name: "Close", exact: true }).click()
    await page.getByRole("button", { name: "မြန်မာ", exact: true }).click()
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await expect(
        page.getByRole("region", { name: "လက်ခံရငွေ", exact: true })
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await page.screenshot({
        path: `test-results/reports-mobile-burmese-${width}.png`,
        fullPage: true,
      })
    }
    expect(errors).toEqual([])
  } finally {
    await staffContext.close()
  }
})

test("current reporting dates refresh at the midnight timer and foreground without changing a historical selection", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.clock.install()
  let dateRequests = 0
  page.on("websocket", (socket) =>
    socket.on("framesent", (frame) => {
      if (String(frame.payload).includes("reports:dates")) dateRequests++
    })
  )
  await createGuestCafe(page)
  const { token } = await (
    await page.request.get("/api/auth/convex/token")
  ).json()
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  client.setAuth(token)
  const storeId = (await client.query(api.stores.workspace, {})).store!._id
  await page.goto("/workspace")
  await expect(
    page.getByRole("region", { name: "Collected", exact: true })
  ).toBeVisible()
  const dates = await client.query(api.reports.dates, {
    storeId,
    refresh: crypto.randomUUID(),
  })
  await page.getByLabel("Reporting day", { exact: true }).fill("2020-01-01")
  const before = dateRequests
  await page.clock.fastForward(dates.nextMidnight - dates.now + 1000)
  await expect.poll(() => dateRequests).toBeGreaterThan(before)
  await expect(page.getByLabel("Reporting day", { exact: true })).toHaveValue(
    "2020-01-01"
  )
  const afterMidnight = dateRequests
  await page.evaluate(() => window.dispatchEvent(new Event("focus")))
  await expect.poll(() => dateRequests).toBeGreaterThan(afterMidnight)
  await page.getByRole("button", { name: "Today", exact: true }).click()
  await expect(page.getByLabel("Reporting day", { exact: true })).toHaveValue(
    dates.day
  )
})
