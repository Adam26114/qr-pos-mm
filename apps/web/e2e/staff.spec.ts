import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test"
import { createJoinLink } from "./helpers/staff-link"

const storeName = "ဝန်ထမ်း Team Cafe"
const password = "CafePassword42!"
const invalidInvitation =
  "This invitation is invalid, used, canceled, or expired. Ask the owner for a new invitation."

test("a single-use share link adds an individual staff account and only the owner can restore deactivated access", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 960 })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const trial = await createOwner(page)
  const invitation = await createJoinLink(page, 3)
  const email = `staff-${crypto.randomUUID()}@example.com`
  const staffName = "Cafe staff · မောင်မောင်"
  const phone = "+95 9 1234 5678"
  const staffContext = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  try {
    const staff = await staffContext.newPage()
    staff.on("pageerror", (error) => errors.push(error.message))
    await staff.goto(invitation)
    const emailInput = staff.getByLabel("Email", { exact: true })
    await expect(emailInput).toHaveValue("")
    await expect(emailInput).toBeEditable()
    await staff.getByLabel("Your name", { exact: true }).fill(staffName)
    await emailInput.fill(email)
    await staff.getByLabel("Password", { exact: true }).fill(password)
    await staff
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    const contact = staff.getByLabel("Contact phone (optional)", {
      exact: true,
    })
    await contact.fill("invalid@phone")
    await staff.getByRole("button", { name: "Join store", exact: true }).click()
    await expect(
      staff.getByText(
        "Enter a contact phone number using digits, spaces, +, parentheses, periods or hyphens, up to 32 characters.",
        { exact: true }
      )
    ).toBeVisible()
    await contact.fill(phone)
    await staff.getByRole("button", { name: "Join store", exact: true }).click()
    await expect(
      staff.getByRole("heading", { name: storeName, exact: true })
    ).toBeVisible()
    await expect(
      staff.getByText("Staff access is active.", { exact: true })
    ).toBeVisible()
    await expect(staff.getByTestId("trial-end")).toHaveCount(0)
    await expect(
      staff.getByRole("button", { name: "Create join link", exact: true })
    ).toHaveCount(0)
    await staff
      .getByRole("button", { name: "Toggle sidebar", exact: true })
      .click()
    const navigation = staff.getByRole("navigation", {
      name: "Workspace",
      exact: true,
    })
    for (const name of ["Staff", "Subscription"])
      await expect(
        navigation.getByRole("link", { name, exact: true })
      ).toHaveCount(0)
    await navigation.getByRole("link", { name: "Menu", exact: true }).click()
    for (const path of ["/workspace/staff", "/workspace/subscription"]) {
      await staff.goto(path)
      await expect(
        staff.getByText("This page is available to the store owner.", {
          exact: true,
        })
      ).toBeVisible()
      await expect(
        staff.getByRole("button", { name: "Create join link", exact: true })
      ).toHaveCount(0)
    }
    await staff.goto("/workspace/menu")
    await expect(
      staff.getByRole("region", { name: "Menu preview", exact: true })
    ).toBeVisible()
    await expect(
      staff.getByRole("button", { name: "Add item", exact: true })
    ).toHaveCount(0)

    await page.getByRole("tab", { name: /^Staff/ }).click()
    const table = page.getByRole("table", { name: "Staff", exact: true })
    const member = table.getByRole("row").filter({ hasText: email })
    await expect(member.getByText(phone, { exact: true })).toBeVisible()
    await expect(member.getByText("Active", { exact: true })).toBeVisible()
    const spareLink = await createJoinLink(page, 1)
    await page.getByRole("tab", { name: /^Staff/ }).click()
    const more = member.getByRole("button", {
      name: `Staff actions: ${staffName}`,
      exact: true,
    })
    await more.click()
    await page
      .getByRole("menuitem", { name: "Deactivate", exact: true })
      .click()
    const confirmation = page.getByRole("alertdialog")
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click()
    await expect(more).toBeFocused()
    await expect(member.getByText("Active", { exact: true })).toBeVisible()
    const status = page.getByRole("combobox", {
      name: "Status",
      exact: true,
    })
    await status.click()
    await page.getByRole("option", { name: "Active", exact: true }).click()
    await confirmMenuAction(page, more, "Deactivate", true)
    await expect(member).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: "Staff", level: 1, exact: true })
    ).toBeFocused()
    await expect(
      page.getByText("No staff match your search or status filter.", {
        exact: true,
      })
    ).toBeVisible()
    await status.click()
    await page
      .getByRole("option", { name: "All statuses", exact: true })
      .click()
    await expect(member.getByText("Deactivated", { exact: true })).toBeVisible()
    await expect(
      staff.getByRole("heading", { name: "Staff access removed.", exact: true })
    ).toBeVisible()
    await expect(
      staff.getByRole("button", { name: "Create store", exact: true })
    ).toHaveCount(0)

    // A fresh unconsumed link cannot let a deactivated account bypass the owner's decision.
    const rejoin = await staffContext.newPage()
    await rejoin.goto(spareLink)
    await rejoin
      .getByRole("button", { name: "Join store", exact: true })
      .click()
    await expect(
      rejoin.getByText(
        "Your access to this store is deactivated. Ask the owner to reactivate it. A new link cannot restore it.",
        { exact: true }
      )
    ).toBeVisible()
    await confirmMenuAction(page, more, "Reactivate")
    await expect(member.getByText("Active", { exact: true })).toBeVisible()
    await expect(member.getByText(phone, { exact: true })).toBeVisible()
    await expect(
      staff.getByRole("region", { name: "Menu preview", exact: true })
    ).toBeVisible()
    await expect(
      staff.getByRole("heading", { name: "Staff access removed.", exact: true })
    ).toHaveCount(0)
    await rejoin.close()
    await page.screenshot({
      path: "test-results/staff-members-desktop.png",
      fullPage: true,
    })
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      for (const language of ["en", "my"] as const) {
        await page
          .getByRole("button", {
            name: language === "en" ? "English" : "မြန်မာ",
            exact: true,
          })
          .click()
        for (const theme of ["light", "dark"] as const) {
          const html = page.locator("html")
          if (
            !(await html.evaluate(
              (element, value) => element.classList.contains(value),
              theme
            ))
          ) {
            await page
              .getByRole("button", { name: "English", exact: true })
              .focus()
            await page.keyboard.press("d")
          }
          await expect(html).toHaveClass(new RegExp(`\\b${theme}\\b`))
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth
            )
          ).toBe(true)
          if (language === "my" && theme === "dark")
            await page.screenshot({
              path: `test-results/staff-members-mobile-my-${width}.png`,
              fullPage: true,
            })
        }
      }
    }
    await page.getByRole("button", { name: "English", exact: true }).click()

    const strangerContext = await browser.newContext({ baseURL })
    try {
      const stranger = await strangerContext.newPage()
      await stranger.goto(invitation)
      await expect(
        stranger.getByText(invalidInvitation, { exact: true })
      ).toBeVisible()
      await expect(
        stranger.getByRole("button", { name: "Create account", exact: true })
      ).toHaveCount(0)
    } finally {
      await strangerContext.close()
    }
    await page.goto("/workspace")
    await expect(page.getByTestId("trial-end")).toHaveText(trial!)
    expect(errors).toEqual([])
  } finally {
    await staffContext.close()
  }
})

test("an existing individual account joins without a contact phone and recovers its staff password", async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  test.setTimeout(90_000)
  const email = `returning-staff-${crypto.randomUUID()}@example.com`
  const staffContext = await browser.newContext({ baseURL })
  try {
    const staff = await staffContext.newPage()
    await staff.goto("/register")
    await staff.getByLabel("Your name", { exact: true }).fill("Existing staff")
    await staff.getByLabel("Email", { exact: true }).fill(email)
    await staff.getByLabel("Password", { exact: true }).fill(password)
    await staff
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await expect(
      staff.getByRole("button", { name: "Create store", exact: true })
    ).toBeVisible()
    await signOut(staff)
    await createOwner(page)
    const invitation = await createJoinLink(page)
    await staff.goto(invitation)
    await staff.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(
      staff.getByRole("heading", { name: "Welcome back.", exact: true })
    ).toBeVisible()
    await staff.getByLabel("Email", { exact: true }).fill(email)
    await staff.getByLabel("Password", { exact: true }).fill(password)
    await staff.getByRole("button", { name: "Sign in", exact: true }).click()
    await expect(
      staff.getByLabel("Contact phone (optional)", { exact: true })
    ).toHaveValue("")
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

test("join-link tables support live revocation, regeneration, filtering, pagination and narrow bilingual layouts", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1440, height: 960 })
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
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
  await createOwner(page)
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(baseURL!).origin,
  })
  const invitation = await createJoinLink(page, 7, true)
  await page.getByRole("tab", { name: /^Join links/ }).click()
  const links = page.getByRole("table", { name: "Join links", exact: true })
  await expect(links.getByRole("row")).toHaveCount(2)
  const original = links.getByRole("row").nth(1)
  const more = original.getByRole("button", { name: /^Link actions:/ })
  const shortId = (await more.getAttribute("aria-label"))!.split(": ").at(-1)!
  const guestContext = await browser.newContext({
    baseURL,
    viewport: { width: 320, height: 844 },
    colorScheme: "light",
  })
  try {
    const guest = await guestContext.newPage()
    guest.on("pageerror", (error) => errors.push(error.message))
    await guest.goto(invitation)
    await expect(guest.getByLabel("Email", { exact: true })).toHaveValue("")
    await expect(guest.getByLabel("Email", { exact: true })).toBeEditable()
    await more.click()
    await page
      .getByRole("menuitem", { name: "Revoke link", exact: true })
      .click()
    const confirmation = page.getByRole("alertdialog")
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click()
    await expect(more).toBeFocused()
    await expect(guest.getByLabel("Your name", { exact: true })).toBeVisible()
    await confirmMenuAction(page, more, "Revoke link")
    await expect(
      guest.getByText(invalidInvitation, { exact: true })
    ).toBeVisible()
    await expect(original.getByText("Canceled", { exact: true })).toBeVisible()
    await confirmMenuAction(page, more, "Regenerate link")
    const ready = page.getByRole("dialog", {
      name: "Your join link is ready",
      exact: true,
    })
    const replacement = await ready
      .getByLabel("Join link", { exact: true })
      .inputValue()
    expect(replacement).not.toBe(invitation)
    await ready.getByRole("button", { name: "Done", exact: true }).click()
    await expect(page.getByRole("dialog")).not.toBeVisible()
    await guest.goto(replacement)
    await expect(guest.getByLabel("Your name", { exact: true })).toBeVisible()
    const invalid = await guestContext.newPage()
    await invalid.goto(invitation)
    await expect(
      invalid.getByText(invalidInvitation, { exact: true })
    ).toBeVisible()
    await invalid.close()

    // Twelve genuine links exercise the same subscribed table and pagination used by owners.
    for (let index = 0; index < 10; index++)
      await createJoinLink(page, index % 2 ? 1 : 3)
    await page.getByRole("tab", { name: /^Join links/ }).click()
    await expect(links.getByRole("row")).toHaveCount(11)
    await page.getByRole("button", { name: "Next", exact: true }).click()
    await expect(links.getByRole("row")).toHaveCount(3)
    await page.getByRole("button", { name: "Previous", exact: true }).click()
    await expect(links.getByRole("row")).toHaveCount(11)
    const pageSize = page.getByRole("combobox", {
      name: "Rows per page",
      exact: true,
    })
    await pageSize.click()
    await page.getByRole("option", { name: "20", exact: true }).click()
    await expect(links.getByRole("row")).toHaveCount(13)
    await expect(
      page.getByRole("button", { name: "Next", exact: true })
    ).toBeDisabled()
    const created = links.getByRole("columnheader", { name: /^Created/ })
    const sort = created.getByRole("button")
    await sort.focus()
    await sort.press("Enter")
    await expect(created).toHaveAttribute("aria-sort", "ascending")
    await expect(links.getByRole("row").nth(1)).toContainText(shortId)
    const search = page.getByLabel("Search join links", { exact: true })
    await search.fill(shortId)
    await expect(links.getByRole("row")).toHaveCount(2)
    await search.fill("")
    const status = page.getByRole("combobox", { name: "Status", exact: true })
    await status.click()
    await page.getByRole("option", { name: "Canceled", exact: true }).click()
    await expect(links.getByRole("row")).toHaveCount(2)
    await search.fill("no matching join link")
    await expect(
      page.getByText("No links match your search or status filter.", {
        exact: true,
      })
    ).toBeVisible()
    await search.fill("")
    await status.click()
    await page
      .getByRole("option", { name: "All statuses", exact: true })
      .click()
    await page.screenshot({
      path: "test-results/staff-join-links-desktop.png",
      fullPage: true,
    })
    await page
      .getByRole("button", { name: "Toggle sidebar", exact: true })
      .click()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await page.screenshot({
      path: "test-results/staff-join-links-desktop-collapsed.png",
      fullPage: true,
    })

    const create = page.getByRole("button", {
      name: "Create join link",
      exact: true,
    })
    await context.setOffline(true)
    await expect(create).toBeDisabled()
    await context.setOffline(false)
    await expect(create).toBeEnabled()
    disconnected = true
    closeSocket!()
    expect(await page.evaluate(() => navigator.onLine)).toBe(true)
    await expect(create).toBeDisabled()
    disconnected = false
    await expect(create).toBeEnabled({ timeout: 15_000 })

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await guest.setViewportSize({ width, height: 844 })
      for (const language of ["en", "my"] as const) {
        for (const screen of [page, guest])
          await screen
            .getByRole("button", {
              name: language === "en" ? "English" : "မြန်မာ",
              exact: true,
            })
            .click()
        const label =
          language === "en" ? "Create join link" : "ဝင်ရောက်ရန် လင့်ခ်ဖန်တီးမည်"
        await expect(
          page.getByRole("button", { name: label, exact: true })
        ).toBeVisible()
        await expect(
          guest.getByLabel(language === "en" ? "Email" : "အီးမေးလ်", {
            exact: true,
          })
        ).toBeEditable()
        for (const theme of ["light", "dark"] as const) {
          for (const screen of [page, guest]) {
            const html = screen.locator("html")
            if (
              !(await html.evaluate(
                (element, value) => element.classList.contains(value),
                theme
              ))
            ) {
              await screen
                .getByRole("button", { name: "English", exact: true })
                .focus()
              await screen.keyboard.press("d")
            }
            await expect(html).toHaveClass(new RegExp(`\\b${theme}\\b`))
            expect(
              await screen.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
              )
            ).toBe(true)
          }
          if (language === "my" && theme === "dark") {
            await page.screenshot({
              path: `test-results/staff-join-links-mobile-my-${width}.png`,
              fullPage: true,
            })
            await guest.screenshot({
              path: `test-results/staff-join-mobile-my-${width}.png`,
              fullPage: true,
            })
          }
        }
      }
    }
    expect(errors).toEqual([])
  } finally {
    await guestContext.close()
  }
})

async function createOwner(page: Page) {
  await page.goto("/register")
  await page.getByLabel("Your name", { exact: true }).fill("Staff owner")
  await page
    .getByLabel("Email", { exact: true })
    .fill(`owner-${crypto.randomUUID()}@example.com`)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click()
  await page.getByLabel("Store name", { exact: true }).fill(storeName)
  await page.getByRole("button", { name: "Create store", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: storeName, exact: true })
  ).toBeVisible()
  const trial = await page.getByTestId("trial-end").textContent()
  await page.goto("/workspace/staff")
  return trial
}

async function confirmMenuAction(
  page: Page,
  trigger: Locator,
  name: string,
  keyboard = false
) {
  const item = page.getByRole("menuitem", { name, exact: true })
  const confirmation = page
    .getByRole("alertdialog")
    .getByRole("button", { name, exact: true })
  if (keyboard) {
    await trigger.focus()
    await trigger.press("Enter")
    await item.press("Enter")
    await confirmation.press("Enter")
  } else {
    await trigger.click()
    await item.click()
    await confirmation.click()
  }
}

async function emailLink(
  request: APIRequestContext,
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

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Account", exact: true }).click()
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click()
}
