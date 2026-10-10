import { expect, test } from "@playwright/test"

test.use({ colorScheme: "light" })

test("theme shortcut ignores keyless events and typing while accepting d and D", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/register")
  await expect(
    page.getByRole("button", { name: "Create account", exact: true })
  ).toBeEnabled()
  const html = page.locator("html")
  await expect(html).toHaveClass(/\blight\b/)

  await page.evaluate(() => window.dispatchEvent(new Event("keydown")))
  await expect(html).toHaveClass(/\blight\b/)
  expect(errors).toEqual([])

  await page.keyboard.press("d")
  await expect(html).toHaveClass(/\bdark\b/)
  await page.keyboard.press("Shift+D")
  await expect(html).toHaveClass(/\blight\b/)

  await page.evaluate(() => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "d", ctrlKey: true })
    )
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "d", repeat: true })
    )
  })
  await expect(html).toHaveClass(/\blight\b/)
  await page.getByLabel("Your name", { exact: true }).focus()
  await page.keyboard.press("d")
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("d")
  await expect(html).toHaveClass(/\blight\b/)
  expect(errors).toEqual([])
})
