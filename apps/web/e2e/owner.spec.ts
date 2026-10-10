import { expect, test } from "@playwright/test"

test("owner registers, creates one store, and retains the trial after signing in again", async ({
  page,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const email = `owner-${crypto.randomUUID()}@example.com`
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Mingalar owner")
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill("Mingalar Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Mingalar Cafe", exact: true })
  ).toBeVisible()
  await expect(page.getByText("Active trial", { exact: true })).toBeVisible()
  const trialDate = await page.getByTestId("trial-end").textContent()
  await page.screenshot({
    path: "test-results/owner-workspace-desktop.png",
    fullPage: true,
  })
  await page.reload()
  await expect(page.getByTestId("trial-end")).toHaveText(trialDate!)
  await signOut(page)
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Mingalar Cafe", exact: true })
  ).toBeVisible()
  await expect(page.getByTestId("trial-end")).toHaveText(trialDate!)
  expect(errors).toEqual([])
})

test("owner recovers a password through captured email and reset links are single use", async ({
  page,
  request,
}) => {
  const email = `recovery-${crypto.randomUUID()}@example.com`
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Recovery owner")
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill("Recovery Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Recovery Cafe" })
  ).toBeVisible()
  const trialDate = await page.getByTestId("trial-end").textContent()
  await signOut(page)
  await page.getByRole("link", { name: "Forgot your password?" }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  await expect(
    page.getByRole("heading", { name: "Let's get you back in." })
  ).toBeVisible()
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click()
  await expect(page.getByRole("status")).toHaveText(
    "If an account exists for this email, a reset link will arrive shortly."
  )
  let resetUrl = ""
  await expect
    .poll(async () => {
      const response = await request.get("http://127.0.0.1:4010/messages")
      const messages = (await response.json()) as {
        to: string[]
        text: string
      }[]
      resetUrl =
        messages
          .find((message) => message.to.includes(email))
          ?.text.match(/https?:\/\/\S+/)?.[0] ?? ""
      return resetUrl
    })
    .not.toBe("")
  await page.goto(resetUrl)
  await page.getByLabel("Password", { exact: true }).fill("UpdatedPassword42!")
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("UpdatedPassword42!")
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click()
  await expect(page.getByRole("status")).toHaveText(
    "Password updated. You can now sign in."
  )
  await page.getByRole("link", { name: "Back to sign in" }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill("UpdatedPassword42!")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Recovery Cafe" })
  ).toBeVisible()
  await expect(page.getByTestId("trial-end")).toHaveText(trialDate!)
  await page.goto(resetUrl)
  await expect(
    page.getByText(
      "This reset link is invalid or has expired. Request a new link.",
      { exact: true }
    )
  ).toBeVisible()
})

test("mobile Burmese signup keeps store content verbatim and prevents offline submissions", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/workspace")
  await expect(page).toHaveURL(/\/login$/)
  await page.goto("/register")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await expect(
    page.getByText("Enter a valid email address.", { exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "မြန်မာ", exact: true }).click()
  await expect(
    page.getByText("မှန်ကန်သော အီးမေးလ်ထည့်ပါ။", { exact: true })
  ).toBeVisible()
  await expect(page.getByLabel("သင့်အမည်", { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("lang", "my")
  await page
    .getByLabel("သင့်အမည်", { exact: true })
    .fill("မင်္ဂလာ ဆိုင်ပိုင်ရှင်")
  await page
    .getByLabel("အီးမေးလ်", { exact: true })
    .fill(`burmese-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("စကားဝှက်", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "အကောင့်ဖန်တီးမည်", exact: true })
    .click()
  await page.getByLabel("ဆိုင်အမည်", { exact: true }).fill("မင်္ဂလာ Cafe")
  await context.setOffline(true)
  await expect(
    page.getByText("အင်တာနက် ပြတ်နေပါသည်။ ဆက်လုပ်ရန် ပြန်ချိတ်ဆက်ပါ။", {
      exact: true,
    })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "ဆိုင်ဖန်တီးမည်", exact: true })
  ).toBeDisabled()
  await context.setOffline(false)
  await page
    .getByRole("button", { name: "ဆိုင်ဖန်တီးမည်", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "မင်္ဂလာ Cafe", exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("အစမ်းသုံးကာလအတွင်း", { exact: true })
  ).toBeVisible()
  await page.screenshot({
    path: "test-results/owner-workspace-mobile-my.png",
    fullPage: true,
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true)
  await page.getByRole("button", { name: "English", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "မင်္ဂလာ Cafe", exact: true })
  ).toBeVisible()
  await expect(page.getByText("Active trial", { exact: true })).toBeVisible()
})

test("unknown recovery email has the same response and sends no email", async ({
  page,
  request,
}) => {
  const email = `unknown-${crypto.randomUUID()}@example.com`
  await page.goto("/forgot-password")
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click()
  await expect(page.getByRole("status")).toHaveText(
    "If an account exists for this email, a reset link will arrive shortly."
  )
  const messages = (await (
    await request.get("http://127.0.0.1:4010/messages")
  ).json()) as { to: string[] }[]
  expect(messages.some((message) => message.to.includes(email))).toBe(false)
})

test("backend disconnection disables store creation while the device remains online", async ({
  page,
}) => {
  let disconnected = false
  let closeSocket: (() => void) | undefined
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:3210\//, (socket) => {
    if (disconnected) {
      socket.close({ code: 1012, reason: "Connection test" })
      return
    }
    socket.connectToServer()
    closeSocket = () => socket.close({ code: 1012, reason: "Connection test" })
  })
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Connection owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`connection-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Create store", exact: true })
  ).toBeEnabled()
  expect(closeSocket).toBeDefined()
  disconnected = true
  closeSocket!()
  expect(await page.evaluate(() => navigator.onLine)).toBe(true)
  await expect(
    page.getByText("Connection lost. Reconnecting to your store…", {
      exact: true,
    })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Create store", exact: true })
  ).toBeDisabled()
  disconnected = false
  await expect(
    page.getByRole("button", { name: "Create store", exact: true })
  ).toBeEnabled({ timeout: 15_000 })
  await expect(page.getByText("Online", { exact: true })).toBeVisible()
  await page.getByLabel("Store name", { exact: true }).fill("Connected Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Connected Cafe", exact: true })
  ).toBeVisible()
})

async function signOut(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Account", exact: true }).click()
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click()
}
