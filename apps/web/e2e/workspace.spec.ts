import { expect, test } from "@playwright/test"

test("dashboard navigation, live summary, theme and subscription survive reloads", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Dashboard owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`dashboard-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill("Dashboard Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Dashboard Cafe", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "Workspace" })
  ).toBeVisible()
  await expect(
    page.getByRole("region", { name: "Menu items", exact: true })
  ).toContainText("0")
  await page
    .getByRole("button", { name: "Toggle sidebar", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Toggle sidebar", exact: true })
  ).toHaveAttribute("aria-expanded", "false")
  await page.getByRole("link", { name: "Menu", exact: true }).click()
  await expect(page).toHaveURL(/\/workspace\/menu$/)
  await page.getByLabel("Category name", { exact: true }).fill("ကော်ဖီ Coffee")
  await page.getByRole("button", { name: "Add category", exact: true }).click()
  await page.getByLabel("Item name", { exact: true }).fill("လက်ဖက်ရည် Tea")
  await page.getByLabel("Price (MMK)", { exact: true }).fill("2500")
  await page.getByRole("button", { name: "Add item", exact: true }).click()
  await expect(
    page.getByText("Menu item saved.", { exact: true })
  ).toBeVisible()
  await page.getByRole("link", { name: "Overview", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Toggle sidebar", exact: true })
  ).toHaveAttribute("aria-expanded", "false")
  await page
    .getByRole("button", { name: "Toggle sidebar", exact: true })
    .click()
  await expect(
    page.getByRole("region", { name: "Menu items", exact: true })
  ).toContainText("1")
  await page.getByRole("link", { name: "Subscription", exact: true }).click()
  await expect(
    page.getByText("30,000 MMK / month", { exact: true })
  ).toBeVisible()
  const trial = await page.getByTestId("trial-end").textContent()
  await page.reload()
  await expect(page.getByTestId("trial-end")).toHaveText(trial!)
  await page.getByRole("button", { name: "Account", exact: true }).click()
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("button", { name: "Account", exact: true }).click()
  await page.getByRole("menuitemradio", { name: "Light", exact: true }).click()
  await page.getByRole("link", { name: "Overview", exact: true }).click()
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("button", { name: "မြန်မာ", exact: true }).click()
  await page
    .getByRole("button", { name: "ဘေးမီနူး ဖွင့်/ပိတ်", exact: true })
    .click()
  const drawer = page.getByRole("dialog", {
    name: "လုပ်ငန်းစာမျက်နှာ",
    exact: true,
  })
  await expect(drawer).toBeVisible()
  await page.screenshot({
    path: "test-results/dashboard-mobile-navigation-my.png",
  })
  await drawer.getByRole("link", { name: "မီနူး", exact: true }).click()
  await expect(drawer).not.toBeVisible()
  await expect(page).toHaveURL(/\/workspace\/menu$/)
  await expect(
    page
      .getByRole("region", { name: "မီနူးအစမ်းကြည့်ရန်", exact: true })
      .getByText("လက်ဖက်ရည် Tea", { exact: true })
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/dashboard-mobile-my.png",
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  expect(errors).toEqual([])
})
