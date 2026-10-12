import { expect, test } from "@playwright/test"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { createGuestCafe } from "./helpers/guest-cafe"

test("owner cancels and records full refunds while staff and guests see separate outcomes", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.emulateMedia({ colorScheme: "light" })
  await page.setViewportSize({ width: 1440, height: 960 })
  await createGuestCafe(page)
  const auth = await page.request.get("/api/auth/convex/token")
  const { token } = await auth.json()
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  client.setAuth(token)
  const workspace = await client.query(api.stores.workspace, {})
  const storeId = workspace.store!._id
  const menu = await client.query(api.menu.manage, { storeId })
  const tables = await client.query(api.tables.list, { storeId })
  const item = menu.items[0]!
  const receiptToken = "a".repeat(32) + crypto.randomUUID().replaceAll("-", "")
  const orderId = await client.mutation(api.guestOrders.submit, {
    storeId,
    tableId: tables.tables[0]!._id,
    token: receiptToken,
    lines: [{ itemId: item._id, quantity: 1, expectedPrice: item.price }],
    note: "Cancelled guest bill · သကြားမပါ",
  })
  await client.mutation(api.orders.recordCash, { storeId, orderId })
  const guestContext = await browser.newContext({ baseURL })
  const staffContext = await browser.newContext({ baseURL })
  try {
    const guest = await guestContext.newPage()
    await guest.goto(`/orders/${receiptToken}`)
    await expect(
      guest.getByText("Cash received", { exact: true })
    ).toBeVisible()
    const invitation = await client.action(api.staff.createJoinLink, {
      storeId,
    })
    const staff = await staffContext.newPage()
    await staff.goto(`/invite/${invitation.token}`)
    await staff.getByLabel("Your name", { exact: true }).fill("Refund cashier")
    await staff
      .getByLabel("Email", { exact: true })
      .fill(`refund-staff-${crypto.randomUUID()}@example.com`)
    await staff.getByLabel("Password", { exact: true }).fill("CafePassword42!")
    await staff
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await staff.getByRole("button", { name: "Join store", exact: true }).click()
    await expect(
      staff.getByRole("heading", { name: "Guest Cafe", exact: true })
    ).toBeVisible()
    await staff.goto("/workspace/orders")
    const staffTicket = staff.locator(`#order-${orderId}`)
    await staffTicket.getByRole("button", { name: /^Order actions:/ }).click()
    await expect(
      staff.getByRole("menuitem", { name: "Cancel order", exact: true })
    ).toHaveCount(0)
    await expect(
      staff.getByRole("menuitem", { name: "Record full refund", exact: true })
    ).toHaveCount(0)
    await staff.keyboard.press("Escape")

    await page.goto("/workspace/orders")
    await page.addStyleTag({ content: "nextjs-portal { display: none }" })
    const ticket = (id: string) => page.locator(`#order-${id}`)
    await ticket(orderId)
      .getByRole("button", { name: /^Order actions:/ })
      .click()
    await page
      .getByRole("menuitem", { name: "Cancel order", exact: true })
      .click()
    const cancel = page.getByRole("alertdialog", {
      name: "Cancel order",
      exact: true,
    })
    await expect(cancel).toBeVisible()
    await cancel
      .getByRole("button", { name: "Cancel order", exact: true })
      .click()
    await expect(cancel.getByRole("alert")).toBeVisible()
    await expect(cancel.getByLabel("Cancellation reason", { exact: true })).toHaveAttribute("aria-describedby", /financial-reason-error/)
    await cancel
      .getByLabel("Cancellation reason", { exact: true })
      .fill("Internal kitchen closure")
    await page.screenshot({
      path: "test-results/refunds-cancel-desktop.png",
      fullPage: true,
    })
    await page.setViewportSize({ width: 320, height: 844 })
    await expect(
      cancel.getByRole("button", { name: "Cancel order", exact: true })
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: "test-results/refunds-cancel-mobile.png",
      fullPage: true,
    })
    await page.setViewportSize({ width: 1440, height: 960 })
    await cancel
      .getByRole("button", { name: "Cancel order", exact: true })
      .click()
    await expect(cancel).not.toBeVisible()
    await expect(page.locator("#orders-lane-pending")).toBeFocused()
    await expect(ticket(orderId)).toHaveCount(0)
    await expect(guest.getByText("Cancelled", { exact: true })).toBeVisible()
    await expect(
      guest.getByText("Internal kitchen closure", { exact: true })
    ).toHaveCount(0)
    await expect(
      guest.getByText("Cash received", { exact: true })
    ).toBeVisible()
    await expect(
      guest.getByText(/Pay cash to the store after eating/)
    ).toHaveCount(0)
    await expect(staffTicket).toHaveCount(0)

    await page.getByRole("tab", { name: "History", exact: true }).click()
    await expect(ticket(orderId)).toBeVisible()
    await ticket(orderId)
      .getByRole("button", { name: /^Order actions:/ })
      .click()
    await page
      .getByRole("menuitem", { name: "Record full refund", exact: true })
      .click()
    const refund = page.getByRole("dialog", {
      name: "Record full refund",
      exact: true,
    })
    await refund
      .getByLabel("Refund reason", { exact: true })
      .fill("Cash returned to guest")
    await refund
      .getByRole("combobox", { name: "Refund completion time", exact: true })
      .click()
    await page
      .getByRole("option", { name: "Earlier time", exact: true })
      .click()
    await refund
      .getByLabel("Earlier time", { exact: true })
      .fill("2000-01-01T10:00")
    await refund
      .getByRole("button", { name: "Record full refund", exact: true })
      .click()
    await expect(
      refund.getByText(
        "Use a valid completion time after actual collection and no later than now.",
        { exact: true }
      )
    ).toBeVisible()
    await expect(
      refund.getByLabel("Refund reason", { exact: true })
    ).toBeEnabled()
    await refund
      .getByRole("combobox", { name: "Refund completion time", exact: true })
      .click()
    await page.getByRole("option", { name: "Now", exact: true }).click()
    await refund
      .getByRole("button", { name: "Record full refund", exact: true })
      .click()
    await expect(refund).not.toBeVisible()
    await expect(
      ticket(orderId).getByText("Refund recorded · 2,500 MMK", { exact: true })
    ).toBeVisible()
    await expect(
      ticket(orderId).getByText("Cash received", { exact: true })
    ).toBeVisible()
    await expect(
      guest.getByText("Refund recorded · 2,500 MMK", { exact: true })
    ).toBeVisible()

    const served = await client.mutation(api.orders.createCounter, {
      storeId,
      submissionKey: crypto.randomUUID(),
      lines: [{ itemId: item._id, quantity: 1, expectedPrice: item.price }],
      note: "Served refund",
    })
    const servedCommand = { storeId, orderId: served }
    await client.mutation(api.orders.recordCash, servedCommand)
    await client.mutation(api.orders.assignDestination, {
      ...servedCommand,
      destination: { kind: "takeaway" },
    })
    await client.mutation(api.orders.startCooking, servedCommand)
    await client.mutation(api.orders.markServed, servedCommand)
    await expect(ticket(served)).toBeVisible()
    await ticket(served)
      .getByRole("button", { name: /^Order actions:/ })
      .click()
    await expect(
      page.getByRole("menuitem", { name: "Cancel order", exact: true })
    ).toHaveCount(0)
    await page
      .getByRole("menuitem", { name: "Record full refund", exact: true })
      .click()
    await refund
      .getByLabel("Refund reason", { exact: true })
      .fill("Returned after handover")
    await refund
      .getByRole("button", { name: "Record full refund", exact: true })
      .click()
    await expect(refund).not.toBeVisible()
    await expect(
      ticket(served).getByText("Served", { exact: true })
    ).toBeVisible()
    await expect(
      ticket(served).getByText("Refund recorded · 2,500 MMK", { exact: true })
    ).toBeVisible()
    await page
      .getByRole("combobox", { name: "History status", exact: true })
      .click()
    await page.getByRole("option", { name: "Cancelled", exact: true }).click()
    await expect(ticket(served)).toHaveCount(0)
    await expect(ticket(orderId)).toBeVisible()
    await page
      .getByRole("combobox", { name: "History status", exact: true })
      .click()
    await page.getByRole("option", { name: "All", exact: true }).click()
    await expect(ticket(served)).toBeVisible()
    await expect(ticket(orderId)).toBeVisible()
    await page.screenshot({
      path: "test-results/refunds-history-desktop.png",
      fullPage: true,
    })
    await page
      .getByRole("button", { name: "Toggle sidebar", exact: true })
      .click()
    await page.screenshot({
      path: "test-results/refunds-history-sidebar.png",
      fullPage: true,
    })
    await page.keyboard.press("d")
    await expect(page.locator("html")).toHaveClass(/dark/)
    await page.screenshot({
      path: "test-results/refunds-history-dark.png",
      fullPage: true,
    })
    await page.getByRole("button", { name: "မြန်မာ", exact: true }).click()
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await expect(
        ticket(orderId).getByText("ပယ်ဖျက်ပြီး", { exact: true })
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await page.screenshot({
        path: `test-results/refunds-history-my-${width}.png`,
        fullPage: true,
      })
    }
    await page.getByRole("button", { name: "English", exact: true }).click()
    await ticket(orderId)
      .getByRole("button", { name: /^Order actions:/ })
      .click()
    await page
      .getByRole("menuitem", { name: "Order history", exact: true })
      .click()
    const history = page.getByRole("dialog", {
      name: "Order history",
      exact: true,
    })
    await expect(
      history.getByText("Internal kitchen closure", { exact: true })
    ).toBeVisible()
    await expect(
      history.getByText("Cash returned to guest", { exact: true })
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: "test-results/refunds-audit-mobile.png",
      fullPage: true,
    })
    await history.getByRole("button", { name: "Close", exact: true }).click()
    await expect(
      ticket(orderId).getByRole("button", { name: /^Order actions:/ })
    ).toBeFocused()
    expect(errors).toEqual([])
  } finally {
    await guestContext.close()
    await staffContext.close()
  }
})
