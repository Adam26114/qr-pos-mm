import { expect, test } from "@playwright/test"
import { readFile } from "node:fs/promises"
import jsQR from "jsqr"

test("owner downloads one scannable menu QR and logged-out guests see live changes on a phone", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("QR owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`qr-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill("ကဖေး QR Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "ကဖေး QR Cafe", exact: true })
  ).toBeVisible()
  await page.goto("/workspace/menu")
  await page.getByRole("button", { name: "Categories", exact: true }).click()
  await page.getByLabel("Category name", { exact: true }).fill("ကော်ဖီ Coffee")
  await page.getByRole("button", { name: "Add category", exact: true }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click()
  await page.getByRole("button", { name: "Add item", exact: true }).click()
  await page.getByLabel("Item name", { exact: true }).fill("လက်ဖက်ရည် Tea")
  await page
    .getByLabel("Description", { exact: true })
    .fill("နို့ပါသည် · With milk")
  await page.getByLabel("Price (MMK)", { exact: true }).fill("2500")
  await page.getByLabel("Photo", { exact: true }).setInputFiles({
    name: "tea.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII=",
      "base64"
    ),
  })
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add item", exact: true })
    .click()
  await expect(page.getByRole("dialog")).not.toBeVisible()
  await page.getByRole("button", { name: "Menu QR", exact: true }).click()
  const qrDialog = page.getByRole("dialog", { name: "Menu QR", exact: true })
  await expect(
    qrDialog.getByRole("link", { name: "Open customer menu", exact: true })
  ).toHaveAttribute("href", /^http:\/\/localhost:3000\/menu\/[^/?#]+$/)
  const menuUrl = await qrDialog
    .getByRole("link", { name: "Open customer menu", exact: true })
    .getAttribute("href")
  expect(menuUrl).toMatch(/^http:\/\/localhost:3000\/menu\/[^/?#]+$/)
  await expect(
    qrDialog.getByRole("img", { name: "Store menu QR", exact: true })
  ).toBeVisible()
  const downloaded = page.waitForEvent("download")
  await qrDialog.getByRole("link", { name: "Download QR", exact: true }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe("menu-qr.svg")
  const svg = await readFile((await download.path())!, "utf8")
  // Decode the downloaded artifact independently of the encoder.
  const pixels = await page.evaluate(async (source) => {
    const image = new Image()
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 720
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(image, 0, 0, 720, 720)
    return Array.from(ctx.getImageData(0, 0, 720, 720).data)
  }, svg)
  expect(jsQR(new Uint8ClampedArray(pixels), 720, 720)?.data).toBe(menuUrl)
  await qrDialog.screenshot({ path: "test-results/menu-qr.png" })
  await qrDialog.getByRole("button", { name: "Close", exact: true }).click()

  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  try {
    const guest = await guestContext.newPage()
    guest.on("pageerror", (error) => errors.push(error.message))
    await guest.goto(menuUrl!)
    await expect(guest.getByRole("heading", { level: 1 })).toHaveText(
      "ကဖေး QR Cafe"
    )
    await expect(guest.getByText("2,500 MMK", { exact: true })).toBeVisible()
    await expect(
      guest.getByText("နို့ပါသည် · With milk", { exact: true })
    ).toBeVisible()
    const photo = guest.getByRole("img", { name: "လက်ဖက်ရည် Tea", exact: true })
    await expect
      .poll(() =>
        photo.evaluate((image) => (image as HTMLImageElement).naturalWidth)
      )
      .toBeGreaterThan(0)
    await guest
      .getByRole("button", { name: "ကော်ဖီ Coffee", exact: true })
      .click()
    await guest.getByRole("button", { name: "မြန်မာ", exact: true }).click()
    await expect(
      guest.getByRole("heading", { name: "မီနူး", exact: true })
    ).toBeVisible()
    await expect(
      guest.getByText("လက်ဖက်ရည် Tea", { exact: true })
    ).toBeVisible()
    await guest.reload()
    await expect(
      guest.getByRole("heading", { name: "မီနူး", exact: true })
    ).toBeVisible()

    await page.getByRole("button", { name: "Edit item", exact: true }).click()
    await page.getByLabel("Price (MMK)", { exact: true }).fill("3000")
    await page.getByRole("switch", { name: "Available", exact: true }).click()
    await page.getByRole("button", { name: "Save item", exact: true }).click()
    await expect(guest.getByText("3,000 MMK", { exact: true })).toBeVisible()
    await expect(guest.getByText("မရရှိနိုင်ပါ", { exact: true })).toBeVisible()
    await guest.screenshot({
      path: "test-results/public-menu-mobile-my.png",
      fullPage: true,
    })
    expect(
      await guest.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await guestContext.setOffline(true)
    await expect(guest.getByRole("main").getByRole("alert")).toBeVisible()
    await guestContext.setOffline(false)
    await expect(guest.getByRole("main").getByRole("alert")).toHaveCount(0)
    await guest.getByRole("button", { name: "English", exact: true }).click()
    await expect(guest.getByText("Unavailable", { exact: true })).toBeVisible()
    await page
      .getByRole("button", { name: "Remove from sale", exact: true })
      .click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Remove from sale", exact: true })
      .click()
    await expect(guest.getByText("လက်ဖက်ရည် Tea", { exact: true })).toHaveCount(
      0
    )
    await expect(
      guest.getByText("No menu items yet.", { exact: true })
    ).toBeVisible()
    await expect(
      guest.getByRole("button", { name: "Add item", exact: true })
    ).toHaveCount(0)
    await page.getByRole("button", { name: "Menu QR", exact: true }).click()
    await expect(
      qrDialog.getByRole("link", { name: "Open customer menu", exact: true })
    ).toHaveAttribute("href", menuUrl!)
    expect(errors).toEqual([])
  } finally {
    await guestContext.close()
  }
})

test("an invalid public menu link stays logged out and explains recovery in either language", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/menu/invalid-link")
  await expect(
    page.getByRole("heading", { name: "Menu not found", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "မြန်မာ", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "မီနူးမတွေ့ပါ", exact: true })
  ).toBeVisible()
  expect(errors).toEqual([])
})
