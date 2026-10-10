import { expect, test } from "@playwright/test"

test("owner creates, edits and removes a persistent menu with verbatim Burmese content", async ({
  page,
  context,
}) => {
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Menu owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`menu-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill("Menu Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Cafe/)
  await page.goto("/workspace/menu")
  await page.getByLabel("Category name", { exact: true }).fill("ကော်ဖီ Coffee")
  await page.getByRole("button", { name: "Add category", exact: true }).click()
  await page.getByLabel("Item name", { exact: true }).fill("လက်ဖက်ရည် Tea")
  await page
    .getByLabel("Description", { exact: true })
    .fill("နို့ပါသည် · With milk")
  await page.getByLabel("Price (MMK)", { exact: true }).fill("2500")
  await page.getByRole("button", { name: "Add item", exact: true }).click()
  const preview = page.getByRole("region", {
    name: "Menu preview",
    exact: true,
  })
  await expect(
    preview.getByText("လက်ဖက်ရည် Tea", { exact: true })
  ).toBeVisible()
  await expect(preview.getByText("2,500 MMK", { exact: true })).toBeVisible()
  await page.reload()
  await expect(
    preview.getByText("နို့ပါသည် · With milk", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Edit item", exact: true }).click()
  await page.getByLabel("Price (MMK)", { exact: true }).fill("3000")
  await page.getByRole("switch", { name: "Available", exact: true }).click()
  await context.setOffline(true)
  await expect(
    page.getByRole("button", { name: "Save item", exact: true })
  ).toBeDisabled()
  await context.setOffline(false)
  await page.getByRole("button", { name: "Save item", exact: true }).click()
  await expect(preview.getByText("3,000 MMK", { exact: true })).toBeVisible()
  await expect(preview.getByText("Unavailable", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "မြန်မာ", exact: true }).click()
  await expect(
    page
      .getByRole("region", { name: "မီနူးအစမ်းကြည့်ရန်", exact: true })
      .getByText("လက်ဖက်ရည် Tea", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "English", exact: true }).click()
  await page
    .getByRole("button", { name: "Remove from sale", exact: true })
    .click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove from sale", exact: true })
    .click()
  await expect(preview.getByText("လက်ဖက်ရည် Tea", { exact: true })).toHaveCount(
    0
  )
  await expect(
    page
      .getByRole("region", { name: "Removed items", exact: true })
      .getByText("လက်ဖက်ရည် Tea", { exact: true })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Remove category", exact: true })
    .click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove category", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Edit category", exact: true })
  ).toHaveCount(0)
  await expect(page.getByLabel("Item name", { exact: true })).toHaveCount(0)
})

test("photos persist and live menu updates reach another owner session on Burmese mobile", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Photo owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`photo-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill("Photo Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Cafe/)
  await page.goto("/workspace/menu")
  await page.getByLabel("Category name", { exact: true }).fill("မုန့် Food")
  await page.getByRole("button", { name: "Add category", exact: true }).click()
  await page.getByRole("button", { name: "Add item", exact: true }).click()
  await expect(
    page.getByText("Enter a positive whole-MMK price.", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "မြန်မာ", exact: true }).click()
  await expect(
    page.getByText("သုညထက်ကြီးသော ကျပ်ပြည့် ဈေးနှုန်းကို ထည့်ပါ။", {
      exact: true,
    })
  ).toBeVisible()
  await page.getByLabel("ပစ္စည်းအမည်", { exact: true }).fill("မုန့် Toast")
  await page.getByLabel("ဈေးနှုန်း (ကျပ်)", { exact: true }).fill("1500.5")
  await page
    .getByRole("button", { name: "ပစ္စည်းထည့်မည်", exact: true })
    .click()
  await expect(
    page.getByText("သုညထက်ကြီးသော ကျပ်ပြည့် ဈေးနှုန်းကို ထည့်ပါ။", {
      exact: true,
    })
  ).toBeVisible()
  await page.getByLabel("ဈေးနှုန်း (ကျပ်)", { exact: true }).fill("1500")
  const chooser = page.waitForEvent("filechooser")
  await page
    .getByRole("button", { name: "ဓာတ်ပုံရွေးမည်", exact: true })
    .click()
  await (
    await chooser
  ).setFiles({
    name: "invalid.png",
    mimeType: "image/png",
    buffer: Buffer.from("This is not a photo"),
  })
  await page
    .getByRole("button", { name: "ပစ္စည်းထည့်မည်", exact: true })
    .click()
  await expect(
    page.getByText("မှန်ကန်သော JPEG၊ PNG သို့မဟုတ် WebP ဓာတ်ပုံ ရွေးပါ။", {
      exact: true,
    })
  ).toBeVisible()
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII=",
    "base64"
  )
  await page
    .getByLabel("ဓာတ်ပုံ", { exact: true })
    .setInputFiles({ name: "toast.png", mimeType: "image/png", buffer: png })
  await page
    .getByRole("button", { name: "ပစ္စည်းထည့်မည်", exact: true })
    .click()
  const preview = page.getByRole("region", {
    name: "မီနူးအစမ်းကြည့်ရန်",
    exact: true,
  })
  await expect(
    preview.getByRole("img", { name: "မုန့် Toast", exact: true })
  ).toBeVisible()
  await expect
    .poll(() =>
      preview
        .getByRole("img", { name: "မုန့် Toast", exact: true })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth)
    )
    .toBeGreaterThan(0)
  const observerContext = await browser.newContext({
    storageState: await page.context().storageState(),
    viewport: { width: 390, height: 844 },
  })
  try {
    const observer = await observerContext.newPage()
    observer.on("pageerror", (error) => errors.push(error.message))
    await observer.goto("http://localhost:3000/workspace/menu")
    const observerPreview = observer.getByRole("region", {
      name: "မီနူးအစမ်းကြည့်ရန်",
      exact: true,
    })
    await expect(
      observerPreview.getByRole("img", { name: "မုန့် Toast", exact: true })
    ).toBeVisible()
    await page
      .getByRole("button", { name: "အမျိုးအစားပြင်မည်", exact: true })
      .click()
    await page
      .getByLabel("အမျိုးအစားအမည်", { exact: true })
      .fill("မနက်စာ Breakfast")
    await page
      .getByRole("button", { name: "အမျိုးအစားသိမ်းမည်", exact: true })
      .click()
    await expect(
      observerPreview.getByRole("heading", {
        name: "မနက်စာ Breakfast",
        exact: true,
      })
    ).toBeVisible()
    await page
      .getByRole("button", { name: "ပစ္စည်းပြင်မည်", exact: true })
      .click()
    await page.getByLabel("ဈေးနှုန်း (ကျပ်)", { exact: true }).fill("2000")
    await page
      .getByRole("button", { name: "ဓာတ်ပုံဖယ်ရှားမည်", exact: true })
      .click()
    await page
      .getByRole("button", { name: "ပစ္စည်းသိမ်းမည်", exact: true })
      .click()
    await expect(
      observerPreview.getByText("2,000 MMK", { exact: true })
    ).toBeVisible()
    await expect(observerPreview.getByRole("img")).toHaveCount(0)
    await page.reload()
    await expect(
      preview.getByText("မုန့် Toast", { exact: true })
    ).toBeVisible()
    await expect(preview.getByRole("img")).toHaveCount(0)
    await page.screenshot({
      path: "test-results/menu-mobile-my.png",
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
