import { expect, test } from "@playwright/test"

test("owner invites an individual staff account and removal updates its open workspace", async ({
  page,
  browser,
  request,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const email = `staff-${crypto.randomUUID()}@example.com`
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Team owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`owner-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill("Team Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Team Cafe", exact: true })
  ).toBeVisible()
  const trial = await page.getByTestId("trial-end").textContent()
  await page.goto("/workspace/staff")
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
  const staffContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  try {
    const staff = await staffContext.newPage()
    staff.on("pageerror", (error) => errors.push(error.message))
    await staff.goto(invitation)
    await staff.getByLabel("Your name", { exact: true }).fill("Cafe staff")
    await staff.getByLabel("Password", { exact: true }).fill("CafePassword42!")
    await staff
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await staff.getByRole("button", { name: "Join store", exact: true }).click()
    await expect(
      staff.getByRole("heading", { name: "Team Cafe", exact: true })
    ).toBeVisible()
    await expect(
      staff.getByText("Staff access is active.", { exact: true })
    ).toBeVisible()
    await expect(
      staff.getByRole("button", { name: "Invite staff", exact: true })
    ).toHaveCount(0)
    await expect(staff.getByTestId("trial-end")).toHaveCount(0)
    await staff
      .getByRole("button", { name: "Toggle sidebar", exact: true })
      .click()
    const navigation = staff.getByRole("navigation", {
      name: "Workspace",
      exact: true,
    })
    await expect(
      navigation.getByRole("link", { name: "Staff", exact: true })
    ).toHaveCount(0)
    await expect(
      navigation.getByRole("link", { name: "Subscription", exact: true })
    ).toHaveCount(0)
    await navigation.getByRole("link", { name: "Menu", exact: true }).click()
    await staff.goto("http://localhost:3000/workspace/staff")
    await expect(
      staff.getByText("This page is available to the store owner.", {
        exact: true,
      })
    ).toBeVisible()
    await expect(
      staff.getByRole("button", { name: "Invite staff", exact: true })
    ).toHaveCount(0)
    await staff.goto("http://localhost:3000/workspace/subscription")
    await expect(
      staff.getByText("This page is available to the store owner.", {
        exact: true,
      })
    ).toBeVisible()
    await expect(staff.getByTestId("trial-end")).toHaveCount(0)
    await staff.goto("http://localhost:3000/workspace/menu")
    await expect(
      staff.getByRole("region", { name: "Menu preview", exact: true })
    ).toBeVisible()
    await expect(
      staff.getByLabel("Category name", { exact: true })
    ).toHaveCount(0)
    await expect(page.getByText(email, { exact: true })).toHaveCount(2)
    await page
      .getByRole("button", { name: "Remove access", exact: true })
      .click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Remove access", exact: true })
      .click()
    await expect(
      staff
        .getByRole("heading", { name: "Staff access removed.", exact: true })
        .first()
    ).toBeVisible()
    await expect(
      staff.getByRole("button", { name: "Create store", exact: true })
    ).toHaveCount(0)
    await page.goto("/workspace")
    await expect(page.getByTestId("trial-end")).toHaveText(trial!)
    await signOut(staff)
    await staff.getByLabel("Email", { exact: true }).fill(email)
    await staff.getByLabel("Password", { exact: true }).fill("CafePassword42!")
    await staff.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(
      staff
        .getByRole("heading", { name: "Staff access removed.", exact: true })
        .first()
    ).toBeVisible()
    await staff.goto(invitation)
    await expect(
      staff.getByText(
        "This invitation is invalid, used, canceled, or expired. Ask the owner for a new invitation.",
        { exact: true }
      )
    ).toBeVisible()
    expect(errors).toEqual([])
  } finally {
    await staffContext.close()
  }
})

test("an existing individual account accepts its invitation and recovers its staff password", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(60_000)
  const email = `returning-staff-${crypto.randomUUID()}@example.com`
  const staffContext = await browser.newContext()
  try {
    const staff = await staffContext.newPage()
    await staff.goto("http://localhost:3000/register")
    await staff.getByLabel("Your name", { exact: true }).fill("Existing staff")
    await staff.getByLabel("Email", { exact: true }).fill(email)
    await staff.getByLabel("Password", { exact: true }).fill("CafePassword42!")
    await staff
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await expect(
      staff.getByRole("button", { name: "Create store", exact: true })
    ).toBeVisible()
    await signOut(staff)
    await createOwner(page)
    await page.getByLabel("Staff email", { exact: true }).fill(email)
    await page
      .getByRole("button", { name: "Invite staff", exact: true })
      .click()
    const invitation = await emailLink(
      request,
      email,
      /http:\/\/localhost:3000\/invite\/[a-f0-9]{64}/
    )
    await staff.goto(invitation)
    await staff.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(
      staff.getByRole("heading", { name: "Welcome back.", exact: true })
    ).toBeVisible()
    await expect(staff.getByLabel("Email", { exact: true })).toHaveValue(email)
    await staff.getByLabel("Password", { exact: true }).fill("CafePassword42!")
    await staff.getByRole("button", { name: "Sign in", exact: true }).click()
    await staff.getByRole("button", { name: "Join store", exact: true }).click()
    await expect(
      staff.getByText("Staff access is active.", { exact: true })
    ).toBeVisible()
    await signOut(staff)
    await staff.getByRole("link", { name: "Forgot your password?" }).click()
    await expect(staff).toHaveURL(/\/forgot-password$/)
    await staff.getByLabel("Email", { exact: true }).fill(email)
    await staff
      .getByRole("button", { name: "Send reset link", exact: true })
      .click()
    const resetUrl = await emailLink(
      request,
      email,
      /https?:\/\/\S*reset-password\S*/
    )
    await staff.goto(resetUrl)
    await staff.getByLabel("Password", { exact: true }).fill("UpdatedStaff42!")
    await staff
      .getByLabel("Confirm password", { exact: true })
      .fill("UpdatedStaff42!")
    await staff
      .getByRole("button", { name: "Reset password", exact: true })
      .click()
    await expect(
      staff.getByText("Password updated. You can now sign in.", { exact: true })
    ).toBeVisible()
    await staff.getByRole("link", { name: "Back to sign in" }).click()
    await expect(staff).toHaveURL(/\/login$/)
    await staff.getByLabel("Email", { exact: true }).fill(email)
    await staff.getByLabel("Password", { exact: true }).fill("UpdatedStaff42!")
    await staff.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(
      staff.getByText("Staff access is active.", { exact: true })
    ).toBeVisible()
    await expect(
      staff.getByRole("button", { name: "Create store", exact: true })
    ).toHaveCount(0)
  } finally {
    await staffContext.close()
  }
})

test("Burmese mobile staff management guards disconnected actions and cancels live invitations", async ({
  page,
  context,
  browser,
  request,
}) => {
  test.setTimeout(60_000)
  let disconnected = false
  let closeSocket: (() => void) | undefined
  await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:3210\//, (socket) => {
    if (disconnected) {
      socket.close({ code: 1012 })
      return
    }
    socket.connectToServer()
    closeSocket = () => socket.close({ code: 1012 })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await createOwner(page)
  await page.getByRole("button", { name: "မြန်မာ", exact: true }).click()
  await page
    .getByRole("button", { name: "ဝန်ထမ်းဖိတ်ကြားမည်", exact: true })
    .click()
  await expect(
    page.getByText("မှန်ကန်သော အီးမေးလ်ထည့်ပါ။", { exact: true })
  ).toBeVisible()
  const email = `mobile-staff-${crypto.randomUUID()}@example.com`
  await page.getByLabel("ဝန်ထမ်းအီးမေးလ်", { exact: true }).fill(email)
  await context.setOffline(true)
  await expect(
    page.getByRole("button", { name: "ဝန်ထမ်းဖိတ်ကြားမည်", exact: true })
  ).toBeDisabled()
  await context.setOffline(false)
  await expect(
    page.getByRole("button", { name: "ဝန်ထမ်းဖိတ်ကြားမည်", exact: true })
  ).toBeEnabled()
  disconnected = true
  closeSocket!()
  expect(await page.evaluate(() => navigator.onLine)).toBe(true)
  await expect(
    page.getByRole("button", { name: "ဝန်ထမ်းဖိတ်ကြားမည်", exact: true })
  ).toBeDisabled()
  disconnected = false
  await expect(
    page.getByRole("button", { name: "ဝန်ထမ်းဖိတ်ကြားမည်", exact: true })
  ).toBeEnabled({ timeout: 15_000 })
  await page
    .getByRole("button", { name: "ဝန်ထမ်းဖိတ်ကြားမည်", exact: true })
    .click()
  const invitation = await emailLink(
    request,
    email,
    /http:\/\/localhost:3000\/invite\/[a-f0-9]{64}/
  )
  const staffContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  try {
    const staff = await staffContext.newPage()
    await staff.goto(invitation)
    await staff.getByRole("button", { name: "မြန်မာ", exact: true }).click()
    await expect(
      staff.getByRole("heading", {
        name: "သင့်ဝန်ထမ်းအကောင့် ဖန်တီးပါ။",
        exact: true,
      })
    ).toBeVisible()
    await expect(staff.getByLabel("အီးမေးလ်", { exact: true })).toHaveValue(
      email
    )
    await staffContext.setOffline(true)
    await expect(
      staff.getByRole("button", { name: "အကောင့်ဖန်တီးမည်", exact: true })
    ).toBeDisabled()
    await staffContext.setOffline(false)
    await page.screenshot({
      path: "test-results/staff-manager-mobile-my.png",
      fullPage: true,
    })
    await staff.screenshot({
      path: "test-results/staff-invitation-mobile-my.png",
      fullPage: true,
    })
    for (const screen of [page, staff])
      expect(
        await screen.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true)
    await page
      .getByRole("button", { name: "ဖိတ်ကြားချက် ပယ်ဖျက်မည်", exact: true })
      .click()
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toBeVisible()
    await dialog
      .getByRole("button", { name: "ပြန်သွားမည်", exact: true })
      .click()
    await expect(dialog).not.toBeVisible()
    await expect(staff.getByLabel("သင့်အမည်", { exact: true })).toBeVisible()
    await page
      .getByRole("button", { name: "ဖိတ်ကြားချက် ပယ်ဖျက်မည်", exact: true })
      .click()
    await dialog
      .getByRole("button", { name: "ဖိတ်ကြားချက် ပယ်ဖျက်မည်", exact: true })
      .click()
    await expect(
      staff.getByText(
        "ဤဖိတ်ကြားချက်သည် မမှန်ပါ၊ အသုံးပြုပြီးပါပြီ၊ ပယ်ဖျက်ထားပါသည် သို့မဟုတ် သက်တမ်းကုန်ပါပြီ။ ဆိုင်ပိုင်ရှင်ထံ ဖိတ်ကြားချက်အသစ် တောင်းပါ။",
        { exact: true }
      )
    ).toBeVisible()
  } finally {
    await staffContext.close()
  }
})

async function createOwner(page: import("@playwright/test").Page) {
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Staff owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`owner-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill("CafePassword42!")
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill("ဝန်ထမ်း Team Cafe")
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "ဝန်ထမ်း Team Cafe", exact: true })
  ).toBeVisible()
  await page.goto("/workspace/staff")
}

async function emailLink(
  request: import("@playwright/test").APIRequestContext,
  email: string,
  pattern: RegExp
) {
  let url = ""
  await expect
    .poll(async () => {
      const messages = (await (
        await request.get("http://127.0.0.1:4010/messages")
      ).json()) as { to: string[]; text: string }[]
      url =
        messages
          .filter((message) => message.to.includes(email))
          .map((message) => message.text.match(pattern)?.[0])
          .reverse()
          .find(Boolean) ?? ""
      return url
    })
    .not.toBe("")
  return url
}

async function signOut(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Account", exact: true }).click()
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click()
}
