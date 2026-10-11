import { expect, type Page } from "@playwright/test"

export async function createGuestCafe(page: Page) {
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
