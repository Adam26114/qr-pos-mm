import { expect, test } from "@playwright/test"
import { createJoinLink } from "./helpers/staff-link"

test("cash counter bill survives lost submission messages and a paid unassigned reload before completion", async ({
  page,
  browser,
  context,
  baseURL,
}) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  let droppedSubmissions = 0
  // Lose the outbound command, then the real retry's acknowledgement. Other clients keep real traffic.
  await page.routeWebSocket(/127\.0\.0\.1:3210/, (socket) => {
    const server = socket.connectToServer()
    let dropResponse = false
    socket.onMessage((message) => {
      const frame = JSON.parse(message.toString())
      if (
        droppedSubmissions < 2 &&
        frame.type === "Mutation" &&
        frame.udfPath === "orders:createCounter"
      ) {
        droppedSubmissions++
        if (droppedSubmissions === 1) return
        dropResponse = true
      }
      server.send(message)
    })
    server.onMessage((message) => {
      if (!dropResponse) socket.send(message)
    })
  })
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("POS owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`pos-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill("POS Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "POS Cafe", exact: true })
  ).toBeVisible()
  await page.goto("/workspace/menu")
  await page.getByRole("button", { name: "Categories", exact: true }).click()
  const categories = page.getByRole("dialog", {
    name: "Categories",
    exact: true,
  })
  await categories.getByLabel("Category name", { exact: true }).fill("Drinks")
  await categories
    .getByRole("button", { name: "Add category", exact: true })
    .click()
  await categories.getByRole("button", { name: "Close", exact: true }).click()
  await page.getByRole("button", { name: "Add item", exact: true }).click()
  const editor = page.getByRole("dialog", { name: "Add item", exact: true })
  await editor.getByLabel("Item name", { exact: true }).fill("လက်ဖက်ရည် Tea")
  await editor.getByLabel("Price (MMK)", { exact: true }).fill("2500")
  await editor.getByRole("button", { name: "Add item", exact: true }).click()
  await expect(editor).not.toBeVisible()
  await page.getByRole("button", { name: "Tables", exact: true }).click()
  const tables = page.getByRole("dialog", { name: "Tables", exact: true })
  await tables.getByLabel("Table number", { exact: true }).fill("4")
  await tables.getByRole("button", { name: "Add table", exact: true }).click()
  await expect(tables.getByText("Table 4", { exact: true })).toBeVisible()
  await tables.getByRole("button", { name: "Close", exact: true }).click()
  await page
    .getByRole("button", { name: "Add to cart: လက်ဖက်ရည် Tea", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Increase: လက်ဖက်ရည် Tea", exact: true })
    .click()
  const cart = page.getByRole("region", { name: "Your cart", exact: true })
  await cart
    .getByLabel("Order note", { exact: true })
    .fill("No sugar · သကြားမပါ")
  await expect(
    cart.getByText("5,000 MMK", { exact: true }).last()
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/pos-desktop-cart.png",
    fullPage: true,
  })
  await context.setOffline(true)
  await expect(
    cart.getByRole("button", { name: "Save cash order", exact: true })
  ).toBeDisabled()
  await context.setOffline(false)
  await cart
    .getByRole("button", { name: "Save cash order", exact: true })
    .click()
  await expect.poll(() => droppedSubmissions).toBe(1)
  await expect(
    cart.getByText(
      "Checking whether your order was saved. Keep this submission until its result is confirmed.",
      { exact: true }
    )
  ).toBeVisible()
  await page.reload()
  await cart
    .getByRole("button", { name: "Retry same submission", exact: true })
    .click()
  await expect.poll(() => droppedSubmissions).toBe(2)
  await page.reload()
  await expect(cart.getByText("Order saved", { exact: true })).toBeVisible()
  await expect(
    cart.getByRole("button", { name: "Assign destination", exact: true })
  ).toHaveCount(0)
  await expect(
    cart.getByText("No sugar · သကြားမပါ", { exact: true })
  ).toBeVisible()
  const observerContext = await browser.newContext({
    storageState: await context.storageState(),
    baseURL,
  })
  try {
    const observer = await observerContext.newPage()
    await observer.goto("/workspace/orders")
    const queue = observer.getByRole("region", {
      name: "Live orders",
      exact: true,
    })
    await expect(queue.getByRole("article")).toHaveCount(1)
    await expect(queue.getByText("Unpaid", { exact: true })).toBeVisible()
    await expect(
      queue.getByRole("button", { name: "Start cooking", exact: true })
    ).toHaveCount(0)
    await expect(
      queue.getByRole("combobox", { name: "Destination", exact: true })
    ).toHaveCount(0)
    await cart
      .getByRole("button", { name: "Payment received", exact: true })
      .click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Payment received", exact: true })
      .click()
    await expect(
      queue.getByText("Cash received", { exact: true })
    ).toBeVisible()
    await page.reload()
    await expect(cart.getByText("Cash received", { exact: true })).toBeVisible()
    await expect(cart.getByText("Unassigned", { exact: true })).toBeVisible()
    await expect(
      queue.getByRole("button", { name: "Start cooking", exact: true })
    ).toHaveCount(0)
    await context.setOffline(true)
    await expect(
      cart.getByRole("button", { name: "Assign destination", exact: true })
    ).toBeDisabled()
    await context.setOffline(false)
    await cart
      .getByRole("button", { name: "Assign destination", exact: true })
      .click()
    const destination = page.getByRole("dialog", {
      name: "Destination",
      exact: true,
    })
    await destination
      .getByRole("button", { name: "Table 4", exact: true })
      .click()
    await context.setOffline(true)
    await expect(
      destination.getByRole("button", {
        name: "Assign destination",
        exact: true,
      })
    ).toBeDisabled()
    await context.setOffline(false)
    await destination
      .getByRole("button", { name: "Assign destination", exact: true })
      .click()
    await expect(destination).not.toBeVisible()
    await expect(
      queue.getByText("Table 4", { exact: true }).first()
    ).toBeVisible()
    await page.getByRole("link", { name: "Orders", exact: true }).click()
    await page
      .getByRole("button", { name: "Start cooking", exact: true })
      .click()
    await expect(queue.getByText("Cooking", { exact: true })).toBeVisible()
    await page.getByRole("button", { name: "Mark served", exact: true }).click()
    await expect(
      queue.getByText("No open orders.", { exact: true })
    ).toBeVisible()
    await page.getByRole("tab", { name: "History", exact: true }).click()
    await expect(
      page.getByText("No sugar · သကြားမပါ", { exact: true })
    ).toBeVisible()
    await page.getByRole("button", { name: /^Order actions:/ }).click()
    await page
      .getByRole("menuitem", { name: "Order history", exact: true })
      .click()
    await expect(
      page.getByRole("dialog").getByText("Destination changed", { exact: true })
    ).toBeVisible()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close", exact: true })
      .click()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole("button", { name: "မြန်မာ", exact: true }).click()
    await expect(
      page.getByText("No sugar · သကြားမပါ", { exact: true })
    ).toBeVisible()
    await page.screenshot({
      path: "test-results/pos-mobile-orders-my.png",
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    expect(errors).toEqual([])
  } finally {
    await observerContext.close()
  }
})

test("staff joins with a share link and can hand over cash orders without owner menu controls", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000)
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Staff POS owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`pos-owner-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill("Staff POS Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Staff POS Cafe", exact: true })
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
  await page.getByLabel("Item name", { exact: true }).fill("Tea")
  await page.getByLabel("Price (MMK)", { exact: true }).fill("1000")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add item", exact: true })
    .click()
  await expect(page.getByRole("dialog")).not.toBeVisible()
  await page
    .getByRole("button", { name: "Item actions: Tea", exact: true })
    .click()
  await page.getByRole("menuitem", { name: "Edit item", exact: true }).click()
  await page.getByLabel("Price (MMK)", { exact: true }).fill("9000")
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByText("Menu item saved.", { exact: true })).toHaveCount(
    0
  )
  await expect(
    page
      .getByRole("region", { name: "Menu preview", exact: true })
      .getByText("1,000 MMK", { exact: true })
  ).toBeVisible()
  await page.getByRole("link", { name: "Staff", exact: true }).click()
  const email = `pos-staff-${crypto.randomUUID()}@example.com`
  const invitation = await createJoinLink(page)
  const staffContext = await browser.newContext({ baseURL })
  try {
    const staff = await staffContext.newPage()
    await staff.goto(invitation)
    await staff.getByLabel("Your name", { exact: true }).fill("Counter staff")
    await staff.getByLabel("Email", { exact: true }).fill(email)
    await staff.getByLabel("Password", { exact: true }).fill("CafePassword42!")
    await staff
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await staff.getByRole("button", { name: "Join store", exact: true }).click()
    await expect(
      staff.getByRole("heading", { name: "Staff POS Cafe", exact: true })
    ).toBeVisible()
    await staff.goto("/workspace/menu")
    for (const label of [
      "Categories",
      "Tables",
      "Add item",
      "Item actions: Tea",
    ])
      await expect(
        staff.getByRole("button", { name: label, exact: true })
      ).toHaveCount(0)
    await page.goto("/workspace/orders")
    await page
      .getByRole("button", { name: "Enable order sound", exact: true })
      .click()
    await expect(
      page.getByRole("button", { name: "Disable order sound", exact: true })
    ).toBeVisible()
    await page.context().setOffline(true)
    await expect(
      page.getByRole("button", { name: "Enable order sound", exact: true })
    ).toBeDisabled()
    await page.context().setOffline(false)
    await expect(
      page.getByRole("button", { name: "Enable order sound", exact: true })
    ).toBeEnabled()
    await staff
      .getByRole("button", { name: "Add to cart: Tea", exact: true })
      .click()
    await staff
      .getByRole("button", { name: "Save cash order", exact: true })
      .click()
    await expect(staff.getByText("Order saved", { exact: true })).toBeVisible()
    await expect(page.getByText("Unpaid", { exact: true })).toBeVisible()
    await staff
      .getByRole("button", { name: "Payment received", exact: true })
      .click()
    await staff
      .getByRole("alertdialog")
      .getByRole("button", { name: "Payment received", exact: true })
      .click()
    await staff
      .getByRole("button", { name: "Assign destination", exact: true })
      .click()
    const destination = staff.getByRole("dialog", {
      name: "Destination",
      exact: true,
    })
    await destination
      .getByRole("button", { name: "Takeaway", exact: true })
      .click()
    await destination
      .getByRole("button", { name: "Assign destination", exact: true })
      .click()
    await expect(page.getByText("Takeaway", { exact: true })).toBeVisible()
    await page
      .getByRole("button", { name: "Enable order sound", exact: true })
      .click()
    await expect(
      page.getByRole("button", { name: "Disable order sound", exact: true })
    ).toBeVisible()
    await staff.goto("/workspace/orders")
    await staff
      .getByRole("button", { name: "Start cooking", exact: true })
      .click()
    await staff
      .getByRole("button", { name: "Mark handed over", exact: true })
      .click()
    await expect(
      page.getByText("No open orders.", { exact: true })
    ).toBeVisible()
    await staff
      .getByRole("tab", { name: "History", exact: true })
      .click()
    await expect(
      staff.getByText("Cash received", { exact: true })
    ).toBeVisible()
  } finally {
    await staffContext.close()
  }
})
