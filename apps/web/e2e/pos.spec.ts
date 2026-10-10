import { expect, test } from "@playwright/test"

test("cash counter bill is recovered after reload and completed through the live Orders page", async ({
  page,
  browser,
  context,
}) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
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
  await expect(cart.getByText("Order saved", { exact: true })).toBeVisible()
  await page.reload()
  await expect(
    cart.getByText("No sugar · သကြားမပါ", { exact: true })
  ).toBeVisible()
  const observerContext = await browser.newContext({
    storageState: await context.storageState(),
  })
  try {
    const observer = await observerContext.newPage()
    await observer.goto("http://localhost:3000/workspace/orders")
    const queue = observer.getByRole("region", {
      name: "Live orders",
      exact: true,
    })
    await expect(queue.getByText("Unpaid", { exact: true })).toBeVisible()
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
    await cart
      .getByRole("combobox", { name: "Destination", exact: true })
      .click()
    await page.getByRole("option", { name: "Table 4", exact: true }).click()
    await cart
      .getByRole("button", { name: "Assign destination", exact: true })
      .click()
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
    await page.getByRole("button", { name: "Served", exact: true }).click()
    await expect(
      page.getByText("No sugar · သကြားမပါ", { exact: true })
    ).toBeVisible()
    await page
      .getByRole("button", { name: "Order history", exact: true })
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

test("invited staff can take and hand over cash orders without owner menu controls", async ({
  page,
  browser,
  request,
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
  await page.getByRole("button", { name: "Edit item", exact: true }).click()
  await page.getByLabel("Price (MMK)", { exact: true }).fill("9000")
  await page
    .getByRole("button", { name: "Cancel editing", exact: true })
    .click()
  await expect(page.getByText("Menu item saved.", { exact: true })).toHaveCount(
    0
  )
  await expect(
    page
      .getByRole("region", { name: "Menu preview", exact: true })
      .getByText("1,000 MMK", { exact: true })
  ).toBeVisible()
  await page.goto("/workspace/staff")
  const email = `pos-staff-${crypto.randomUUID()}@example.com`
  await page.getByLabel("Staff email", { exact: true }).fill(email)
  await page.getByRole("button", { name: "Invite staff", exact: true }).click()
  let invitation = ""
  await expect
    .poll(async () => {
      const messages = (await (
        await request.get("http://127.0.0.1:4010/messages")
      ).json()) as { to: string[]; text: string }[]
      invitation =
        messages
          .find((message) => message.to.includes(email))
          ?.text.match(/http:\/\/localhost:3000\/invite\/[a-f0-9]{64}/)?.[0] ??
        ""
      return invitation
    })
    .not.toBe("")
  const staffContext = await browser.newContext()
  try {
    const staff = await staffContext.newPage()
    await staff.goto(invitation)
    await staff.getByLabel("Your name", { exact: true }).fill("Counter staff")
    await staff.getByLabel("Password", { exact: true }).fill("CafePassword42!")
    await staff
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await staff.getByRole("button", { name: "Join store", exact: true }).click()
    await expect(
      staff.getByRole("heading", { name: "Staff POS Cafe", exact: true })
    ).toBeVisible()
    await staff.goto("http://localhost:3000/workspace/menu")
    for (const label of ["Categories", "Tables", "Add item", "Edit item"])
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
      .getByRole("combobox", { name: "Destination", exact: true })
      .click()
    await staff.getByRole("option", { name: "Takeaway", exact: true }).click()
    await staff
      .getByRole("button", { name: "Assign destination", exact: true })
      .click()
    await expect(page.getByText("Takeaway", { exact: true })).toBeVisible()
    await page
      .getByRole("button", { name: "Enable order sound", exact: true })
      .click()
    await expect(
      page.getByRole("button", { name: "Disable order sound", exact: true })
    ).toBeVisible()
    await staff.goto("http://localhost:3000/workspace/orders")
    await staff
      .getByRole("button", { name: "Start cooking", exact: true })
      .click()
    await staff
      .getByRole("button", { name: "Mark handed over", exact: true })
      .click()
    await expect(
      page.getByText("No open orders.", { exact: true })
    ).toBeVisible()
    await staff.getByRole("button", { name: "Served", exact: true }).click()
    await expect(
      staff.getByText("Cash received", { exact: true })
    ).toBeVisible()
  } finally {
    await staffContext.close()
  }
})
