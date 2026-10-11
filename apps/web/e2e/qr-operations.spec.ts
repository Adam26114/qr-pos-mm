import { expect, test, type Page } from "@playwright/test"
import { createGuestCafe } from "./helpers/guest-cafe"

test("staff prepares seated cash, corrects its table, collects after serving and alerts only for fresh work", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(120_000)
  const menuUrl = await createGuestCafe(page)
  await page.getByRole("button", { name: "Tables", exact: true }).click()
  await page.getByLabel("Table number", { exact: true }).fill("7")
  await page.getByRole("button", { name: "Add table", exact: true }).click()
  await expect(page.getByText("Table 7", { exact: true })).toBeVisible()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click()
  await page.goto("/workspace/staff")
  const email = `qr-staff-${crypto.randomUUID()}@example.com`
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
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const staff = await staffContext.newPage()
  const guest = await guestContext.newPage()
  const errors: string[] = []
  for (const tab of [staff, guest])
    tab.on("pageerror", (error) => errors.push(error.message))
  // Observe calls to the real Web Audio output boundary, without replacing application modules.
  await staff.addInitScript(() => {
    const output = window as typeof window & { audioAlerts: number }
    output.audioAlerts = 0
    const original = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (when) {
      output.audioAlerts++
      original.call(this, when)
    }
  })
  const audioAlerts = () =>
    staff.evaluate(
      () => (window as typeof window & { audioAlerts: number }).audioAlerts
    )
  try {
    await staff.goto(invitation)
    await staff.getByLabel("Your name", { exact: true }).fill("Seated staff")
    await staff.getByLabel("Password", { exact: true }).fill("CafePassword42!")
    await staff
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await staff.getByRole("button", { name: "Join store", exact: true }).click()
    await expect(
      staff.getByRole("heading", { name: "Guest Cafe", exact: true })
    ).toBeVisible()
    await staff.goto("http://localhost:3000/workspace/orders")
    for (const name of ["Staff", "Subscription"])
      await expect(staff.getByRole("link", { name, exact: true })).toHaveCount(
        0
      )
    await page.goto("/workspace/orders")
    await staff
      .getByRole("button", { name: "Enable order sound", exact: true })
      .click()
    await expect(
      staff.getByRole("button", { name: "Disable order sound", exact: true })
    ).toBeVisible()
    expect(await audioAlerts()).toBe(0)
    await guest.goto(menuUrl)
    await submit(guest, "No sugar · သကြားမပါ", 2)
    const queue = staff.getByRole("region", {
      name: "Live orders",
      exact: true,
    })
    const ownerQueue = page.getByRole("region", {
      name: "Live orders",
      exact: true,
    })
    await expect(
      queue.getByText("No sugar · သကြားမပါ", { exact: true })
    ).toBeVisible()
    await expect(queue.getByText("New order", { exact: true })).toBeVisible({
      timeout: 5000,
    })
    await expect.poll(audioAlerts).toBe(1)
    await expect(
      ownerQueue.getByText("5,000 MMK", { exact: true }).last()
    ).toBeVisible()
    await staffContext.setOffline(true)
    for (const name of [
      "Correct destination",
      "Start cooking",
      "Payment received",
    ])
      await expect(
        queue.getByRole("button", { name, exact: true })
      ).toBeDisabled()
    await staffContext.setOffline(false)
    await queue
      .getByRole("button", { name: "Correct destination", exact: true })
      .click()
    await queue
      .getByRole("combobox", { name: "Destination", exact: true })
      .click()
    await expect(
      staff.getByRole("option", { name: "Takeaway", exact: true })
    ).toHaveCount(0)
    await staff.getByRole("option", { name: "Table 7", exact: true }).click()
    await queue
      .getByRole("button", { name: "Assign destination", exact: true })
      .click()
    await expect(guest.getByText("Table 7", { exact: true })).toBeVisible()
    await expect(guest.getByText("Unpaid", { exact: true })).toBeVisible()
    await queue
      .getByRole("button", { name: "Start cooking", exact: true })
      .click()
    await expect(guest.getByText("Cooking", { exact: true })).toBeVisible()
    await expect(ownerQueue.getByText("Cooking", { exact: true })).toBeVisible()
    await staff.getByRole("button", { name: "မြန်မာ", exact: true }).click()
    await expect(
      staff.getByText("No sugar · သကြားမပါ", { exact: true })
    ).toBeVisible()
    await staff.screenshot({
      path: "test-results/qr-operations-mobile-my.png",
      fullPage: true,
    })
    expect(
      await staff.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true)
    await staff.getByRole("button", { name: "English", exact: true }).click()
    await queue
      .getByRole("button", { name: "Mark served", exact: true })
      .click()
    await expect(guest.getByText("Served", { exact: true })).toBeVisible()
    await expect(guest.getByText("Unpaid", { exact: true })).toBeVisible()
    await expect(
      queue.getByText("Awaiting cash", { exact: true })
    ).toBeVisible()
    await guest.reload()
    await expect(guest.getByText("Served", { exact: true })).toBeVisible()
    await queue
      .getByRole("button", { name: "Payment received", exact: true })
      .click()
    await staff
      .getByRole("alertdialog")
      .getByRole("button", { name: "Payment received", exact: true })
      .click()
    await expect(
      queue.getByText("No open orders.", { exact: true })
    ).toBeVisible()
    await expect(
      ownerQueue.getByText("No open orders.", { exact: true })
    ).toBeVisible()
    await expect(
      guest.getByText("Cash received", { exact: true })
    ).toBeVisible()
    await expect(guest.getByText("Served", { exact: true })).toBeVisible()
    await staff.getByRole("button", { name: "Served", exact: true }).click()
    await staff
      .getByRole("button", { name: "Order history", exact: true })
      .click()
    const history = staff.getByRole("dialog")
    for (const event of [
      "Destination changed",
      "Cooking",
      "Served",
      "Cash received",
    ])
      await expect(history.getByText(event, { exact: true })).toHaveCount(1)
    await expect(
      history.getByText("Table 4 → Table 7", { exact: true })
    ).toBeVisible()
    await history.getByRole("button", { name: "Close", exact: true }).click()
    await staff
      .getByRole("button", { name: "Live orders", exact: true })
      .click()
    await staff
      .getByRole("button", { name: "Enable order sound", exact: true })
      .click()
    await expect(
      staff.getByRole("button", { name: "Disable order sound", exact: true })
    ).toBeVisible()
    await staffContext.setOffline(true)
    await guest
      .getByRole("button", { name: "Order again", exact: true })
      .click()
    await submit(guest, "While disconnected")
    await expect(
      ownerQueue.getByText("While disconnected", { exact: true })
    ).toBeVisible()
    await staffContext.setOffline(false)
    await expect(
      queue.getByText("While disconnected", { exact: true })
    ).toBeVisible()
    await expect(queue.getByText("New order", { exact: true })).toHaveCount(0)
    await staff
      .getByRole("button", { name: "Enable order sound", exact: true })
      .click()
    await expect(
      staff.getByRole("button", { name: "Disable order sound", exact: true })
    ).toBeVisible()
    expect(await audioAlerts()).toBe(1)
    await guest
      .getByRole("button", { name: "Order again", exact: true })
      .click()
    await submit(guest, "Fresh after reconnect")
    await expect(
      queue.getByText("Fresh after reconnect", { exact: true })
    ).toBeVisible()
    await expect.poll(audioAlerts).toBe(2)
    await expect(queue.getByText("New order", { exact: true })).toHaveCount(1)
    await staff
      .getByRole("button", { name: "Mark all seen", exact: true })
      .click()
    await expect(queue.getByText("New order", { exact: true })).toHaveCount(0)
    await staff
      .getByRole("button", { name: "Disable order sound", exact: true })
      .click()
    await guest
      .getByRole("button", { name: "Order again", exact: true })
      .click()
    await submit(guest, "With sound disabled")
    await expect(
      queue.getByText("With sound disabled", { exact: true })
    ).toBeVisible()
    await expect(queue.getByText("New order", { exact: true })).toHaveCount(1)
    expect(await audioAlerts()).toBe(2)
    expect(errors).toEqual([])
  } finally {
    await staffContext.close()
    await guestContext.close()
  }
})

async function submit(page: Page, note: string, quantity = 1) {
  await page
    .getByRole("button", { name: "Add to cart: လက်ဖက်ရည် Tea", exact: true })
    .click()
  if (quantity === 2)
    await page
      .getByRole("button", { name: "Increase: လက်ဖက်ရည် Tea", exact: true })
      .click()
  await page.getByLabel("Order note", { exact: true }).fill(note)
  await page.getByRole("button", { name: "Review order", exact: true }).click()
  await page.getByRole("combobox", { name: "Your table", exact: true }).click()
  await page.getByRole("option", { name: "Table 4", exact: true }).click()
  await page
    .getByRole("button", { name: "Submit cash order", exact: true })
    .click()
  await expect(page).toHaveURL(/\/orders\/[a-f0-9]{64}$/)
}
