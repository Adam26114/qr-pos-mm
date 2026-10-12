import { expect, test } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
test.use({ actionTimeout: 20000 })
import { createGuestCafe } from "./helpers/guest-cafe"
import type { Id } from "../convex/_generated/dataModel"
function outcome(
  attemptId: Id<"paymentAttempts">,
  result: "succeeded" | "expired" | "uncertain",
  transactionId?: string,
  notify = true
) {
  execFileSync(
    "bunx",
    [
      "convex",
      "run",
      "simulator:outcome",
      JSON.stringify({ attemptId, outcome: result, transactionId, notify }),
    ],
    { encoding: "utf8", timeout: 20000 }
  )
}

test("local guest and staff MMQR recover lost responses, reconcile payment gates and resolve owner exceptions", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(240000)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.emulateMedia({ colorScheme: "light" })
  const menuUrl = await createGuestCafe(page)
  const { token } = await (
    await page.request.get("/api/auth/convex/token")
  ).json()
  const owner = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  owner.setAuth(token)
  const storeId = (await owner.query(api.stores.workspace, {})).store!._id
  const invite = await owner.action(api.staff.createJoinLink, { storeId })
  const guestContext = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  })
  const staffContext = await browser.newContext({ baseURL })
  try {
    const guest = await guestContext.newPage(),
      staff = await staffContext.newPage()
    guest.on("pageerror", (error) => errors.push(error.message))
    staff.on("pageerror", (error) => errors.push(error.message))
    let lostCounter = false
    await staff.routeWebSocket(/127\.0\.0\.1:3210/, (socket) => {
      const server = socket.connectToServer()
      let requestId: number | undefined
      socket.onMessage((message) => {
        const frame = JSON.parse(message.toString())
        if (
          !lostCounter &&
          frame.type === "Mutation" &&
          frame.udfPath === "orders:createCounter"
        )
          requestId = frame.requestId
        server.send(message)
      })
      server.onMessage((message) => {
        const frame = JSON.parse(message.toString())
        if (
          !lostCounter &&
          frame.type === "MutationResponse" &&
          frame.requestId === requestId
        ) {
          lostCounter = true
          return
        }
        socket.send(message)
      })
    })
    let lost = false
    await guest.routeWebSocket(/127\.0\.0\.1:3210/, (socket) => {
      const server = socket.connectToServer()
      let requestId: number | undefined
      socket.onMessage((message) => {
        const frame = JSON.parse(message.toString())
        if (
          !lost &&
          frame.type === "Action" &&
          frame.udfPath === "payments:startGuest"
        )
          requestId = frame.requestId
        server.send(message)
      })
      server.onMessage((message) => {
        const frame = JSON.parse(message.toString())
        if (
          !lost &&
          frame.type === "ActionResponse" &&
          frame.requestId === requestId
        ) {
          lost = true
          return
        }
        socket.send(message)
      })
    })
    await staff.goto(`/invite/${invite.token}`)
    await staff.getByLabel("Your name", { exact: true }).fill("Payment cashier")
    await staff
      .getByLabel("Email", { exact: true })
      .fill(`payment-staff-${crypto.randomUUID()}@example.com`)
    await staff.getByLabel("Password", { exact: true }).fill("CafePassword42!")
    await staff
      .getByRole("button", { name: "Create account", exact: true })
      .click()
    await staff.getByRole("button", { name: "Join store", exact: true }).click()
    await expect(
      staff.getByRole("heading", { name: "Guest Cafe", exact: true })
    ).toBeVisible()
    await guest.goto(menuUrl)
    await guest
      .getByRole("button", { name: "Add to cart: လက်ဖက်ရည် Tea", exact: true })
      .click()
    await guest
      .getByRole("button", { name: "Review order", exact: true })
      .click()
    await guest
      .getByRole("combobox", { name: "Your table", exact: true })
      .click()
    await guest.getByRole("option", { name: "Table 4", exact: true }).click()
    await guest
      .getByRole("combobox", { name: "Payment method", exact: true })
      .click()
    await guest
      .getByRole("option", { name: "MMQR — simulation", exact: true })
      .click()
    await guest
      .getByRole("button", { name: "Submit MMQR order", exact: true })
      .click()
    await expect(
      guest.getByRole("img", { name: "Non-payable MMQR test QR" })
    ).toBeVisible()
    await expect.poll(() => lost).toBe(true)
    const capability = new URL(guest.url()).pathname.split("/").at(-1)!
    const receipt = await owner.query(api.guestOrders.track, {
      token: capability,
    })
    const orderId = receipt!.order._id
    const command = { storeId, orderId }
    const attemptId = (await owner.query(api.payments.counterCheckout, command))
      .attempt!._id
    await guest.reload()
    await expect(
      guest.getByRole("button", { name: "Check payment", exact: true })
    ).toBeEnabled()
    expect(
      (await owner.query(api.payments.counterCheckout, command)).attempt!._id
    ).toBe(attemptId)
    await staff.goto("/workspace/orders")
    const ticket = staff.locator(`#order-${orderId}`)
    await expect(
      ticket.getByRole("button", { name: "MMQR checkout", exact: true })
    ).toBeVisible()
    await expect(
      ticket.getByRole("button", { name: "Start cooking", exact: true })
    ).toHaveCount(0)
    await guest.screenshot({
      path: "test-results/mmqr-guest-mobile.png",
      fullPage: true,
      animations: "disabled",
    })
    outcome(attemptId, "uncertain", undefined, false)
    await guest
      .getByRole("button", { name: "Check payment", exact: true })
      .click()
    await expect(
      guest.getByText(
        "Payment status is uncertain. Check again before retrying.",
        { exact: true }
      )
    ).toBeVisible()
    outcome(attemptId, "succeeded", "guest-confirmed", false)
    await guest
      .getByRole("button", { name: "Check payment", exact: true })
      .focus()
    await guest.keyboard.press("Enter")
    await expect(
      guest.getByRole("region", { name: "MMQR checkout", exact: true })
    ).toBeFocused()
    await expect(
      ticket.getByRole("button", { name: "Start cooking", exact: true })
    ).toBeVisible()
    await ticket
      .getByRole("button", { name: "Start cooking", exact: true })
      .click()
    await expect(guest.getByText("Cooking", { exact: true })).toBeVisible()
    outcome(attemptId, "succeeded", "guest-extra")
    await page.goto("/workspace/orders")
    await page
      .getByRole("button", { name: "Review payments", exact: true })
      .click()
    await expect(
      page.getByRole("dialog").getByRole("article").first()
    ).toBeVisible()
    await page.screenshot({
      path: "test-results/mmqr-owner-review-desktop.png",
      fullPage: true,
      animations: "disabled",
    })
    await page
      .getByRole("dialog", { name: "Review payments", exact: true })
      .getByRole("button", { name: "Record full refund", exact: true })
      .click()
    const refund = page.getByRole("dialog", {
      name: "Record full refund",
      exact: true,
    })
    await refund
      .getByRole("combobox", { name: "Collected payment", exact: true })
      .click()
    await page.getByRole("option").first().click()
    await refund
      .getByLabel("Refund reason", { exact: true })
      .fill("Returned extra test money")
    await refund
      .getByRole("button", { name: "Record full refund", exact: true })
      .click()
    await expect(refund).not.toBeVisible()
    await expect(
      page.getByRole("button", { name: "Review payments", exact: true })
    ).toHaveCount(0)
    await expect(page.locator("#orders-heading")).toBeFocused()
    await expect(
      staff.getByRole("button", { name: "Review payments", exact: true })
    ).toHaveCount(0)
    await staff.goto("/workspace/menu")
    await staff
      .getByRole("button", { name: "Add to cart: လက်ဖက်ရည် Tea", exact: true })
      .click()
    await staff
      .getByRole("combobox", { name: "Payment method", exact: true })
      .click()
    await staff
      .getByRole("option", { name: "MMQR — simulation", exact: true })
      .click()
    await staff
      .getByRole("button", { name: "Save MMQR order", exact: true })
      .click()
    await expect.poll(() => lostCounter).toBe(true)
    await staff.reload()
    await expect(
      staff.getByRole("img", { name: "Non-payable MMQR test QR" })
    ).toBeVisible()
    await expect(
      staff.getByRole("button", { name: "Assign destination", exact: true })
    ).toHaveCount(0)
    const queue = await owner.query(api.orders.queue, { storeId })
    const counter = queue.find((order) => order.source === "counter")!
    const counterAttempt = (
      await owner.query(api.payments.counterCheckout, {
        storeId,
        orderId: counter._id,
      })
    ).attempt!._id
    outcome(counterAttempt, "expired", undefined, false)
    await staff
      .getByRole("button", { name: "Check payment", exact: true })
      .click()
    await staff
      .getByRole("button", { name: "Retry MMQR checkout", exact: true })
      .click()
    await expect
      .poll(
        async () =>
          (
            await owner.query(api.payments.counterCheckout, {
              storeId,
              orderId: counter._id,
            })
          ).attempt!._id
      )
      .not.toBe(counterAttempt)
    await staff.reload()
    await expect(
      staff.getByRole("img", { name: "Non-payable MMQR test QR" })
    ).toBeVisible()
    const current = (
      await owner.query(api.payments.counterCheckout, {
        storeId,
        orderId: counter._id,
      })
    ).attempt!._id
    await staff
      .getByRole("button", { name: "Check payment", exact: true })
      .focus()
    outcome(current, "succeeded", "counter-confirmed")
    await expect(
      staff.getByRole("region", { name: "MMQR checkout", exact: true })
    ).toBeFocused()
    await staff
      .getByRole("button", { name: "Assign destination", exact: true })
      .click()
    await staff.getByRole("button", { name: "Takeaway", exact: true }).click()
    await staff
      .getByRole("dialog")
      .getByRole("button", { name: "Assign destination", exact: true })
      .click()
    await staff.goto("/workspace/orders")
    await staff
      .locator(`#order-${counter._id}`)
      .getByRole("button", { name: "Start cooking", exact: true })
      .click()
    await staff
      .locator(`#order-${counter._id}`)
      .getByRole("button", { name: "Mark handed over", exact: true })
      .click()
    await page.goto("/workspace")
    await expect(
      page.getByText("MMQR — simulation", { exact: true }).first()
    ).toBeVisible()
    await page.screenshot({
      path: "test-results/mmqr-reports-desktop.png",
      fullPage: true,
      animations: "disabled",
    })
    await guest.getByRole("button", { name: "မြန်မာ", exact: true }).click()
    for (const colorScheme of ["light", "dark"] as const) {
      await guest.emulateMedia({ colorScheme })
      await expect(guest.locator("html")).toHaveClass(
        colorScheme === "dark" ? /dark/ : /light/
      )
      for (const width of [320, 390]) {
        await guest.setViewportSize({ width, height: 844 })
        expect(
          await guest.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          )
        ).toBe(true)
        await guest.screenshot({
          path: `test-results/mmqr-guest-my-${colorScheme}-${width}.png`,
          fullPage: true,
          animations: "disabled",
        })
      }
    }
    await owner.mutation(api.orders.cancel, {
      ...command,
      requestKey: crypto.randomUUID(),
      reason: "Cancelled after payment",
    })
    outcome(attemptId, "succeeded", "cancelled-late")
    await expect(guest.getByText("ပယ်ဖျက်ပြီး", { exact: true })).toBeVisible()
    await page.goto("/workspace/orders")
    for (const colorScheme of ["light", "dark"] as const) {
      await page.getByRole("button", { name: "English", exact: true }).click()
      await page.setViewportSize({ width: 1440, height: 960 })
      await page.getByRole("button", { name: "Account", exact: true }).click()
      await page
        .getByRole("menuitemradio", {
          name: colorScheme === "dark" ? "Dark" : "Light",
          exact: true,
        })
        .click()
      await page.keyboard.press("Escape")
      await expect(page.getByRole("menu")).toHaveCount(0)
      await expect(page.locator("html")).toHaveClass(
        colorScheme === "dark" ? /dark/ : /light/
      )
      for (const language of ["English", "မြန်မာ"]) {
        await page.getByRole("button", { name: language, exact: true }).click()
        const reviewLabel =
          language === "English" ? "Review payments" : "ငွေပေးချေမှု စစ်ဆေးမည်"
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: 960 })
          await page
            .getByRole("button", { name: reviewLabel, exact: true })
            .click()
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth
            )
          ).toBe(true)
          await expect(
            page.getByRole("dialog").getByRole("article").first()
          ).toBeVisible()
          expect(
            await page
              .getByRole("dialog")
              .getByRole("article")
              .evaluateAll((articles) =>
                articles.every((article) => {
                  const boundary = article.getBoundingClientRect()
                  return [...article.querySelectorAll("button")].every(
                    (button) => {
                      const rect = button.getBoundingClientRect()
                      return (
                        rect.left >= boundary.left &&
                        rect.right <= boundary.right
                      )
                    }
                  )
                })
              )
          ).toBe(true)
          await page.screenshot({
            path: `test-results/mmqr-review-${language === "English" ? "en" : "my"}-${colorScheme}-${width}.png`,
            fullPage: true,
            animations: "disabled",
          })
          await page.keyboard.press("Escape")
          await expect(
            page.getByRole("button", { name: reviewLabel, exact: true })
          ).toBeFocused()
        }
      }
    }
    await page.getByRole("button", { name: "English", exact: true }).click()
    await page.setViewportSize({ width: 1440, height: 960 })
    await page
      .getByRole("button", { name: "Toggle sidebar", exact: true })
      .click()
    await page.screenshot({
      path: "test-results/mmqr-orders-collapsed-desktop.png",
      fullPage: true,
      animations: "disabled",
    })
    expect(errors).toEqual([])
  } finally {
    await guestContext.close()
    await staffContext.close()
  }
})

test("lost guest MMQR submission preserves its immutable method through reload and retries", async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(90000)
  const menuUrl = await createGuestCafe(page)
  const { token } = await (
    await page.request.get("/api/auth/convex/token")
  ).json()
  const owner = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  owner.setAuth(token)
  const storeId = (await owner.query(api.stores.workspace, {})).store!._id
  const context = await browser.newContext({ baseURL })
  try {
    const guest = await context.newPage()
    let dropped = false
    await guest.routeWebSocket(/127\.0\.0\.1:3210/, (socket) => {
      const server = socket.connectToServer()
      socket.onMessage((message) => {
        const frame = JSON.parse(message.toString())
        if (
          !dropped &&
          frame.type === "Mutation" &&
          frame.udfPath === "guestOrders:submit"
        ) {
          dropped = true
          return
        }
        server.send(message)
      })
      server.onMessage((message) => socket.send(message))
    })
    await guest.goto(menuUrl)
    await guest
      .getByRole("button", { name: "Add to cart: လက်ဖက်ရည် Tea", exact: true })
      .click()
    await guest
      .getByRole("button", { name: "Review order", exact: true })
      .click()
    await guest
      .getByRole("combobox", { name: "Your table", exact: true })
      .click()
    await guest.getByRole("option", { name: "Table 4", exact: true }).click()
    await guest
      .getByRole("combobox", { name: "Payment method", exact: true })
      .click()
    await guest
      .getByRole("option", { name: "MMQR — simulation", exact: true })
      .click()
    await guest
      .getByRole("button", { name: "Submit MMQR order", exact: true })
      .click()
    await expect.poll(() => dropped).toBe(true)
    expect(await owner.query(api.orders.queue, { storeId })).toHaveLength(0)
    await guest.reload()
    execFileSync(
      "bunx",
      ["convex", "run", "simulator:creation", '{"available":false}'],
      { encoding: "utf8", timeout: 20000 }
    )
    await guest
      .getByRole("button", { name: "Retry same submission", exact: true })
      .click()
    await expect(
      guest.getByRole("button", { name: "Recover checkout", exact: true })
    ).toBeVisible()
    const unresolved = (await owner.query(api.orders.queue, { storeId }))[0]!
    const originalAttempt = (
      await owner.query(api.payments.counterCheckout, {
        storeId,
        orderId: unresolved._id,
      })
    ).attempt!._id
    execFileSync(
      "bunx",
      ["convex", "run", "simulator:creation", '{"available":true}'],
      { encoding: "utf8", timeout: 20000 }
    )
    await guest.reload()
    await guest
      .getByRole("button", { name: "Recover checkout", exact: true })
      .click()
    expect(
      (
        await owner.query(api.payments.counterCheckout, {
          storeId,
          orderId: unresolved._id,
        })
      ).attempt!._id
    ).toBe(originalAttempt)
    await expect(
      guest.getByRole("img", { name: "Non-payable MMQR test QR" })
    ).toBeVisible()
    const queue = await owner.query(api.orders.queue, { storeId })
    expect(queue).toHaveLength(1)
    expect(queue[0]?.paymentMethod).toBe("mmqr")
    await guest.reload()
    expect(await owner.query(api.orders.queue, { storeId })).toHaveLength(1)
    await expect(
      guest.getByRole("button", { name: "Check payment", exact: true })
    ).toBeEnabled()
  } finally {
    execFileSync(
      "bunx",
      ["convex", "run", "simulator:creation", '{"available":true}'],
      { encoding: "utf8", timeout: 20000 }
    )
    await context.close()
  }
})
