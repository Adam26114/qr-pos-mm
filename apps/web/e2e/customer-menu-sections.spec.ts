import { expect, test, type Page } from "@playwright/test"

const categoryA = "A · ကော်ဖီ Coffee"
const categoryB = "B · မုန့် Pastries"
const categoryEmpty = "C · Empty"
const itemA1 = "parison-coffee"
const itemA2 = `A2 · ${"လက်ဖက်ရည်".repeat(10)}`
const itemB1 = "Zesty pastry"
const itemB2 = "Apple pastry"
const note = "No sugar · သကြားမပါ " + "အော်ဒါမှတ်ချက်".repeat(10)

async function addItem(
  page: Page,
  item: {
    name: string
    category: string
    price: number
    signature?: boolean
    available?: boolean
    description?: string
  }
) {
  await page.getByRole("button", { name: "Add item", exact: true }).click()
  const editor = page.getByRole("dialog", { name: "Add item", exact: true })
  await editor.getByLabel("Item name", { exact: true }).fill(item.name)
  await editor
    .getByLabel("Price (MMK)", { exact: true })
    .fill(String(item.price))
  await editor
    .getByRole("button", { name: "Choose a category", exact: true })
    .click()
  await editor
    .getByRole("combobox", { name: "Category", exact: true })
    .fill(item.category)
  await page.getByRole("option", { name: item.category, exact: true }).click()
  if (item.description)
    await editor
      .getByLabel("Description", { exact: true })
      .fill(item.description)
  const signature = editor.getByRole("switch", {
    name: "Signature item",
    exact: true,
  })
  await expect(signature).toHaveAttribute("aria-checked", "false")
  if (item.signature) await signature.click()
  if (item.available === false)
    await editor.getByRole("switch", { name: "Available", exact: true }).click()
  await editor.getByRole("button", { name: "Add item", exact: true }).click()
  await expect(editor).not.toBeVisible()
}

async function editSignature(page: Page, name: string, selected: boolean) {
  await page
    .getByRole("button", { name: `Item actions: ${name}`, exact: true })
    .click()
  await page.getByRole("menuitem", { name: "Edit item", exact: true }).click()
  const editor = page.getByRole("dialog", { name: "Edit item", exact: true })
  const signature = editor.getByRole("switch", {
    name: "Signature item",
    exact: true,
  })
  await expect(signature).toHaveAttribute("aria-checked", String(!selected))
  await signature.click()
  await editor.getByRole("button", { name: "Save item", exact: true }).click()
  await expect(editor).not.toBeVisible()
}

test("customer sections keep authored order and signature cards share a live cart across filters and languages", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000)
  await page.setViewportSize({ width: 1440, height: 960 })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Signature owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`signature-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page
    .getByLabel("Store name", { exact: true })
    .fill("parison · ပါရီဆန် ကဖေး")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "parison · ပါရီဆန် ကဖေး"
  )
  await page.goto("/workspace/menu")
  await page.getByRole("button", { name: "Categories", exact: true }).click()
  const categories = page.getByRole("dialog", {
    name: "Categories",
    exact: true,
  })
  for (const category of [categoryA, categoryB, categoryEmpty]) {
    await categories.getByLabel("Category name", { exact: true }).fill(category)
    await categories
      .getByRole("button", { name: "Add category", exact: true })
      .click()
    await expect(categories.getByText(category, { exact: true })).toBeVisible()
  }
  await categories.getByRole("button", { name: "Close", exact: true }).click()
  // Interleave categories and reverse alphabetical names to expose accidental global/name sorting.
  await addItem(page, {
    name: itemB1,
    category: categoryB,
    price: 4000,
    signature: true,
  })
  await addItem(page, {
    name: itemA1,
    category: categoryA,
    price: 2500,
    signature: true,
  })
  await addItem(page, { name: itemB2, category: categoryB, price: 3000 })
  await addItem(page, {
    name: itemA2,
    category: categoryA,
    price: 987654321000,
    available: false,
    signature: true,
    description: "ရှည်လျားသောမီနူးအကြောင်းအရာ".repeat(15),
  })
  const workspace = page.getByRole("region", {
    name: "Menu preview",
    exact: true,
  })
  await expect(workspace.getByText("Signature", { exact: true })).toHaveCount(3)
  await page.getByRole("button", { name: "Menu QR", exact: true }).click()
  const qr = page.getByRole("dialog", { name: "Menu QR", exact: true })
  const menuUrl = await qr
    .getByRole("link", { name: "Open customer menu", exact: true })
    .getAttribute("href")
  expect(new URL(menuUrl!).origin).toBe(new URL(baseURL!).origin)
  await qr.getByRole("button", { name: "Close", exact: true }).click()

  const guestContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 960 },
    colorScheme: "light",
  })
  try {
    const guest = await guestContext.newPage()
    guest.on("pageerror", (error) => errors.push(error.message))
    await guest.goto(menuUrl!)
    const catalog = guest.getByRole("region", {
      name: "Menu preview",
      exact: true,
    })
    const section = (name: string) =>
      catalog.getByRole("region", { name, exact: true })
    const signature = section("Signature items")
    const coffee = section(categoryA)
    const pastries = section(categoryB)
    await expect(catalog.getByRole("heading", { level: 3 })).toHaveText([
      "Signature items",
      categoryA,
      categoryB,
    ])
    await expect(signature.getByRole("heading", { level: 4 })).toHaveText([
      itemB1,
      itemA1,
      itemA2,
    ])
    await expect(coffee.getByRole("heading", { level: 4 })).toHaveText([
      itemA1,
      itemA2,
    ])
    await expect(pastries.getByRole("heading", { level: 4 })).toHaveText([
      itemB1,
      itemB2,
    ])
    await expect(section(categoryEmpty)).toHaveCount(0)
    await expect(signature.getByText("Signature", { exact: true })).toHaveCount(
      3
    )
    for (const region of [signature, coffee])
      await expect(
        region.getByRole("button", {
          name: `Add to cart: ${itemA2}`,
          exact: true,
        })
      ).toBeDisabled()

    const signatureCoffee = signature.getByRole("button", {
      name: `Add to cart: ${itemA1}`,
      exact: true,
    })
    await signatureCoffee.focus()
    await signatureCoffee.press("Enter")
    await expect(signatureCoffee).toBeFocused()
    await coffee
      .getByRole("button", { name: `Add to cart: ${itemA1}`, exact: true })
      .click()
    await signature
      .getByRole("button", { name: `Add to cart: ${itemB1}`, exact: true })
      .click()
    const cart = guest.getByRole("region", { name: "Your cart", exact: true })
    await expect(cart.getByRole("listitem")).toHaveCount(2)
    const coffeeLine = cart.getByRole("listitem").filter({ hasText: itemA1 })
    await expect(coffeeLine.getByText("2", { exact: true })).toBeVisible()
    await expect(
      coffeeLine.getByText("5,000 MMK", { exact: true })
    ).toBeVisible()
    await cart.getByLabel("Order note", { exact: true }).fill(note)
    await expect(cart.getByText("9,000 MMK", { exact: true })).toBeVisible()

    const search = guest.getByRole("searchbox", {
      name: "Search menu",
      exact: true,
    })
    await search.fill("pastry")
    await expect(catalog.getByRole("heading", { level: 3 })).toHaveText([
      "Signature items",
      categoryB,
    ])
    await expect(signature.getByRole("heading", { level: 4 })).toHaveText([
      itemB1,
    ])
    await expect(pastries.getByRole("heading", { level: 4 })).toHaveText([
      itemB1,
      itemB2,
    ])
    await expect(coffee).toHaveCount(0)
    await search.fill("does not exist")
    await expect(catalog.getByRole("heading", { level: 3 })).toHaveCount(0)
    await expect(
      catalog.getByText("No matching items.", { exact: true })
    ).toBeVisible()
    await search.fill("")
    const filter = guest.getByRole("group", {
      name: "Filter category",
      exact: true,
    })
    const categoryButton = filter.getByRole("button", {
      name: categoryA,
      exact: true,
    })
    await categoryButton.focus()
    await categoryButton.press("Enter")
    await expect(categoryButton).toBeFocused()
    await expect(categoryButton).toHaveAttribute("aria-pressed", "true")
    await expect(catalog.getByRole("heading", { level: 3 })).toHaveText([
      categoryA,
    ])
    await expect(coffee.getByRole("heading", { level: 4 })).toHaveText([
      itemA1,
      itemA2,
    ])
    await expect(signature).toHaveCount(0)
    await filter
      .getByRole("button", { name: categoryEmpty, exact: true })
      .click()
    await expect(catalog.getByRole("heading", { level: 3 })).toHaveCount(0)
    await expect(
      catalog.getByText("No matching items.", { exact: true })
    ).toBeVisible()
    await filter.getByRole("button", { name: "All items", exact: true }).click()
    await expect(cart.getByRole("listitem")).toHaveCount(2)
    await expect(coffeeLine.getByText("2", { exact: true })).toBeVisible()
    await expect(cart.getByLabel("Order note", { exact: true })).toHaveValue(
      note
    )

    await editSignature(page, itemA1, false)
    await expect(signature.getByRole("heading", { level: 4 })).toHaveText([
      itemB1,
      itemA2,
    ])
    await expect(
      coffee.getByRole("heading", { name: itemA1, exact: true })
    ).toBeVisible()
    await expect(cart.getByRole("listitem")).toHaveCount(2)
    await expect(coffeeLine.getByText("2", { exact: true })).toBeVisible()
    await editSignature(page, itemB2, true)
    await expect(signature.getByRole("heading", { level: 4 })).toHaveText([
      itemB1,
      itemB2,
      itemA2,
    ])
    await expect(cart.getByLabel("Order note", { exact: true })).toHaveValue(
      note
    )
    await expect(cart.getByText("9,000 MMK", { exact: true })).toBeVisible()
    await guest.screenshot({
      path: "test-results/customer-menu-sections-desktop.png",
      fullPage: true,
    })

    for (const width of [1440, 390, 320]) {
      await guest.setViewportSize({ width, height: width === 1440 ? 960 : 844 })
      for (const language of ["en", "my"] as const) {
        await guest
          .getByRole("button", {
            name: language === "en" ? "English" : "မြန်မာ",
            exact: true,
          })
          .click()
        const localizedCatalog = guest.getByRole("region", {
          name: language === "en" ? "Menu preview" : "မီနူးအစမ်းကြည့်ရန်",
          exact: true,
        })
        const localizedCart = guest.getByRole("region", {
          name: language === "en" ? "Your cart" : "သင့်ခြင်း",
          exact: true,
        })
        await expect(
          localizedCatalog.getByRole("heading", { level: 3 })
        ).toHaveText([
          language === "en" ? "Signature items" : "ဆိုင်၏ အထူးမီနူးများ",
          categoryA,
          categoryB,
        ])
        await expect(localizedCart.getByRole("listitem")).toHaveCount(2)
        await expect(guest.locator("#guest-note")).toHaveValue(note)
        await expect(
          localizedCatalog.getByRole("heading", { name: itemA2, exact: true })
        ).toHaveCount(2)
        for (const theme of ["light", "dark"] as const) {
          const html = guest.locator("html")
          if (
            !(await html.evaluate(
              (element, value) => element.classList.contains(value),
              theme
            ))
          ) {
            await guest
              .getByRole("button", { name: "English", exact: true })
              .focus()
            await guest.keyboard.press("d")
          }
          await expect(html).toHaveClass(new RegExp(`\\b${theme}\\b`))
          expect(
            await guest.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth
            )
          ).toBe(true)
          if (width !== 1440 && language === "my" && theme === "dark")
            await guest.screenshot({
              path: `test-results/customer-menu-sections-mobile-my-${width}.png`,
              fullPage: true,
            })
        }
      }
    }
    expect(errors).toEqual([])
  } finally {
    await guestContext.close()
  }
})
