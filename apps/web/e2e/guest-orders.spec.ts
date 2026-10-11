import { expect, test, type Page } from "@playwright/test"

test("a guest reviews a cash bill, selects a table and retains separate private tracking links", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000)
  const menuUrl = await setup(page)
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const guest = await guestContext.newPage()
  const errors: string[] = []
  guest.on("pageerror", (error) => errors.push(error.message))
  try {
    await guest.goto(menuUrl!)
    await guest
      .getByRole("button", { name: "Add to cart: လက်ဖက်ရည် Tea", exact: true })
      .click({ timeout: 5000 })
    await guest
      .getByRole("button", { name: "Increase: လက်ဖက်ရည် Tea", exact: true })
      .click()
    await guest
      .getByLabel("Order note", { exact: true })
      .fill("No sugar · သကြားမပါ")
    await guest
      .getByRole("button", { name: "Review order", exact: true })
      .click()
    await expect(
      guest.getByText("5,000 MMK", { exact: true }).last()
    ).toBeVisible()
    await guest
      .getByRole("combobox", { name: "Your table", exact: true })
      .click()
    await guest.getByRole("option", { name: "Table 4", exact: true }).click()
    await guestContext.setOffline(true)
    await expect(
      guest.getByRole("button", { name: "Submit cash order", exact: true })
    ).toBeDisabled()
    await guestContext.setOffline(false)
    await guest
      .getByRole("button", { name: "Submit cash order", exact: true })
      .click()
    await expect(guest).toHaveURL(/\/orders\/[a-f0-9]{64}$/)
    const firstUrl = guest.url()
    await expect(
      guest.getByText("No sugar · သကြားမပါ", { exact: true })
    ).toBeVisible()
    await expect(guest.getByText("Unpaid", { exact: true })).toBeVisible()
    await guest.reload()
    await expect(
      guest.getByText("5,000 MMK", { exact: true }).last()
    ).toBeVisible()
    await guest.getByRole("button", { name: "မြန်မာ", exact: true }).click()
    await expect(
      guest.getByText("လက်ဖက်ရည် Tea", { exact: false })
    ).toBeVisible()
    await guest.screenshot({
      path: "test-results/guest-tracking-mobile-my.png",
      fullPage: true,
    })
    expect(
      await guest.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await guest.getByRole("button", { name: "English", exact: true }).click()
    await expect(
      guest.getByLabel("Tracking link", { exact: true })
    ).toHaveValue(firstUrl)
    await guestContext.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(firstUrl).origin,
    })
    await guest
      .getByRole("button", { name: "Copy tracking link", exact: true })
      .click()
    await expect(
      guest.getByText("Tracking link copied.", { exact: true })
    ).toBeVisible()
    expect(await guest.evaluate(() => navigator.clipboard.readText())).toBe(
      firstUrl
    )
    await guest
      .getByRole("button", { name: "Order again", exact: true })
      .click()
    await expect(guest).toHaveURL(menuUrl!)
    await guest
      .getByRole("button", { name: "Add to cart: လက်ဖက်ရည် Tea", exact: true })
      .click()
    await guest
      .getByRole("button", { name: "Review order", exact: true })
      .click()
    await guest
      .getByRole("combobox", { name: "Your table", exact: true })
      .click()
    await guest.getByRole("option", { name: "Table 4", exact: true }).click()
    await guest
      .getByRole("button", { name: "Submit cash order", exact: true })
      .click()
    await expect(guest).toHaveURL(/\/orders\/[a-f0-9]{64}$/)
    expect(guest.url()).not.toBe(firstUrl)
    const secondUrl = guest.url()
    await page.goto("/workspace/orders")
    await expect(
      page
        .getByRole("region", { name: "Live orders", exact: true })
        .getByRole("heading", { level: 2 })
    ).toHaveCount(2)
    await expect(
      page.getByText("No sugar · သကြားမပါ", { exact: true })
    ).toBeVisible()
    const sharedBrowser = await browser.newContext()
    const stranger = await sharedBrowser.newPage()
    try {
      await stranger.goto(`/orders/${"f".repeat(64)}`)
      await expect(
        stranger.getByRole("heading", { name: "Order not found", exact: true })
      ).toBeVisible()
      const secondTab = await sharedBrowser.newPage()
      await Promise.all([stranger.goto(firstUrl), secondTab.goto(secondUrl)])
      await expect(
        stranger.getByText("5,000 MMK", { exact: true }).last()
      ).toBeVisible()
      await Promise.all(
        [stranger, secondTab].map((tab) =>
          tab.getByRole("button", { name: "Order again", exact: true }).click()
        )
      )
      for (const tab of [stranger, secondTab])
        await expect(
          tab
            .getByRole("navigation", {
              name: "Your previous orders",
              exact: true,
            })
            .getByRole("link")
        ).toHaveCount(2)
    } finally {
      await sharedBrowser.close()
    }
    expect(errors).toEqual([])
  } finally {
    await guestContext.close()
  }
})

test("a changed menu requires another review and a lost acknowledgement recovers the accepted bill", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000)
  const menuUrl = await setup(page)
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const guest = await context.newPage()
  let droppedSubmissions = 0
  // First lose the outbound command, then lose the acknowledgement of its real retry.
  await guest.routeWebSocket(/127\.0\.0\.1:3210/, (socket) => {
    const server = socket.connectToServer()
    let drop = false
    socket.onMessage((message) => {
      const frame = JSON.parse(message.toString())
      if (
        droppedSubmissions < 2 &&
        frame.type === "Mutation" &&
        frame.udfPath === "guestOrders:submit"
      ) {
        droppedSubmissions++
        if (droppedSubmissions === 1) return
        drop = true
      }
      server.send(message)
    })
    server.onMessage((message) => {
      if (!drop) socket.send(message)
    })
  })
  try {
    await guest.goto(menuUrl)
    const add = guest.getByRole("button", {
      name: "Add to cart: လက်ဖက်ရည် Tea",
      exact: true,
    })
    await add.click()
    await guest
      .getByRole("button", { name: "Review order", exact: true })
      .click()
    await expect(add).toBeDisabled()
    await page.getByRole("button", { name: "Edit item", exact: true }).click()
    await page.getByLabel("Price (MMK)", { exact: true }).fill("3000")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save item", exact: true })
      .click()
    await expect(
      guest.getByText(
        "The menu changed. Go back to your cart and review it again before submitting.",
        { exact: true }
      )
    ).toBeVisible()
    await expect(
      guest.getByRole("button", { name: "Submit cash order", exact: true })
    ).toBeDisabled()
    const cart = guest.getByRole("region", { name: "Your cart", exact: true })
    await expect(
      cart.getByText("2,500 MMK", { exact: true }).last()
    ).toBeVisible()
    await guest
      .getByRole("button", { name: "Back to cart", exact: true })
      .click()
    await guest
      .getByRole("button", { name: "Review order", exact: true })
      .click()
    await expect(
      cart.getByText("3,000 MMK", { exact: true }).last()
    ).toBeVisible()
    await guest
      .getByRole("combobox", { name: "Your table", exact: true })
      .click()
    await guest.getByRole("option", { name: "Table 4", exact: true }).click()
    await guest.screenshot({
      path: "test-results/guest-review-mobile.png",
      fullPage: true,
    })
    await guest
      .getByRole("button", { name: "Submit cash order", exact: true })
      .click()
    await expect.poll(() => droppedSubmissions).toBe(1)
    await page.goto("/workspace/orders")
    const queue = page.getByRole("region", { name: "Live orders", exact: true })
    await expect(
      queue.getByText("No open orders.", { exact: true })
    ).toBeVisible()
    await guest.reload()
    await guest
      .getByRole("button", { name: "Retry same submission", exact: true })
      .click()
    await expect.poll(() => droppedSubmissions).toBe(2)
    await expect(queue.getByRole("heading", { level: 2 })).toHaveCount(1)
    await expect(
      queue.getByText("3,000 MMK", { exact: true }).last()
    ).toBeVisible()
    await guest.reload()
    await guest.getByRole("link", { name: "Track order", exact: true }).click()
    await expect(guest).toHaveURL(/\/orders\/[a-f0-9]{64}$/)
    await expect(
      guest.getByText("3,000 MMK", { exact: true }).last()
    ).toBeVisible()
    await guest
      .getByRole("button", { name: "Order again", exact: true })
      .click()
    await expect(
      guest
        .getByRole("navigation", { name: "Your previous orders", exact: true })
        .getByRole("link")
    ).toHaveCount(1)
    await expect(queue.getByRole("heading", { level: 2 })).toHaveCount(1)
  } finally {
    await context.close()
  }
})

async function setup(page: Page) {
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Guest order owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`guest-orders-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill("Guest Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Guest Cafe", exact: true })
  ).toBeVisible()
  await page.goto("/workspace/menu")
  await page.getByRole("button", { name: "Categories", exact: true }).click()
  await page.getByLabel("Category name", { exact: true }).fill("Drinks")
  await page.getByRole("button", { name: "Add category", exact: true }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click()
  await page.getByRole("button", { name: "Add item", exact: true }).click()
  await page.getByLabel("Item name", { exact: true }).fill("လက်ဖက်ရည် Tea")
  await page.getByLabel("Price (MMK)", { exact: true }).fill("2500")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add item", exact: true })
    .click()
  await expect(page.getByRole("dialog")).not.toBeVisible()
  await page.getByRole("button", { name: "Tables", exact: true }).click()
  await page.getByLabel("Table number", { exact: true }).fill("4")
  await page.getByRole("button", { name: "Add table", exact: true }).click()
  await expect(page.getByText("Table 4", { exact: true })).toBeVisible()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click()
  await page.getByRole("button", { name: "Menu QR", exact: true }).click()
  const menuUrl = await page
    .getByRole("link", { name: "Open customer menu", exact: true })
    .getAttribute("href")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click()
  return menuUrl!
}
