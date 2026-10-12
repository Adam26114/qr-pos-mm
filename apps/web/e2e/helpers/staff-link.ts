import { expect, type Page } from "@playwright/test"

export async function createJoinLink(
  page: Page,
  days: 1 | 3 | 7 = 7,
  copy = false
) {
  await page
    .getByRole("button", { name: "Create join link", exact: true })
    .click()
  const create = page.getByRole("dialog", {
    name: "Create join link",
    exact: true,
  })
  const expiry = create.getByRole("combobox", {
    name: "Link expires after",
    exact: true,
  })
  await expect(expiry).toHaveText("7 days")
  if (days !== 7) {
    await expiry.click()
    await page
      .getByRole("option", {
        name: days === 1 ? "1 day" : "3 days",
        exact: true,
      })
      .click()
  }
  await create
    .getByRole("button", { name: "Create join link", exact: true })
    .click()
  const ready = page.getByRole("dialog", {
    name: "Your join link is ready",
    exact: true,
  })
  const link = ready.getByRole("textbox", { name: "Join link", exact: true })
  await expect(link).toHaveAttribute("readonly", "")
  const url = await link.inputValue()
  expect(new URL(url).origin).toBe(new URL(page.url()).origin)
  expect(new URL(url).pathname).toMatch(/^\/invite\/[a-f0-9]{64}$/)
  if (copy) {
    await ready.getByRole("button", { name: "Copy link", exact: true }).click()
    await expect(ready.getByText("Link copied.", { exact: true })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url)
  }
  await ready.getByRole("button", { name: "Done", exact: true }).click()
  // Closing clears the result title before the portal's exit transition finishes.
  await expect(page.getByRole("dialog")).not.toBeVisible()
  return url
}
