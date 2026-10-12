import { afterEach, expect, test, vi } from "vitest"
import { api, internal } from "./_generated/api"
import { authenticate, backend } from "../test/convex"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})
function localPayments() {
  vi.stubEnv("ORDER_PAYMENT_SIMULATOR", "enabled")
  vi.stubEnv(
    "SIMULATOR_EVENT_SECRET",
    "local-test-only-payment-event-signing-key"
  )
  vi.stubEnv("CONVEX_CLOUD_URL", "http://127.0.0.1:3210")
}
async function cafe() {
  const t = backend()
  const owner = await authenticate(t, `${crypto.randomUUID()}@example.com`)
  const storeId = await owner.mutation(api.stores.create, {
    name: "Payment Cafe",
  })
  const categoryId = await owner.mutation(api.menu.saveCategory, {
    storeId,
    name: "Drinks",
  })
  const itemId = await owner.mutation(api.menu.saveItem, {
    storeId,
    categoryId,
    name: "Tea",
    description: "",
    price: 2500,
    available: true,
    photoId: null,
  })
  const tableId = await owner.mutation(api.tables.add, { storeId, number: 1 })
  const lines = [{ itemId, quantity: 1, expectedPrice: 2500 }]
  return { t, owner, storeId, tableId, lines }
}

test("MMQR selection is immutable and gates preparation and counter assignment without changing legacy cash retries", async () => {
  localPayments()
  const { t, owner, storeId, tableId, lines } = await cafe()
  const cash = { storeId, lines, note: "", submissionKey: crypto.randomUUID() }
  const cashId = await owner.mutation(api.orders.createCounter, cash)
  expect(await owner.mutation(api.orders.createCounter, cash)).toBe(cashId)
  await expect(
    owner.mutation(api.orders.createCounter, { ...cash, paymentMethod: "mmqr" })
  ).rejects.toThrow("SUBMISSION_KEY_REUSED")
  const counter = await owner.mutation(api.orders.createCounter, {
    ...cash,
    submissionKey: crypto.randomUUID(),
    paymentMethod: "mmqr",
  })
  await expect(
    owner.mutation(api.orders.recordCash, { storeId, orderId: counter })
  ).rejects.toThrow("PAYMENT_METHOD_FIXED")
  await expect(
    owner.mutation(api.orders.assignDestination, {
      storeId,
      orderId: counter,
      destination: { kind: "takeaway" },
    })
  ).rejects.toThrow("PAYMENT_REQUIRED")
  const token = "a".repeat(64)
  const guest = await t.mutation(api.guestOrders.submit, {
    storeId,
    tableId,
    token,
    lines,
    note: "",
    paymentMethod: "mmqr",
  })
  await expect(
    owner.mutation(api.orders.startCooking, { storeId, orderId: guest })
  ).rejects.toThrow("PAYMENT_REQUIRED")
  expect(
    await owner.mutation(api.orders.soundBaseline, { storeId })
  ).not.toContain(guest)
  expect(
    (await t.query(api.guestOrders.track, { token }))?.order.paymentMethod
  ).toBe("mmqr")
  await owner.mutation(api.orders.recordCash, { storeId, orderId: cashId })
  await owner.mutation(api.orders.assignDestination, {
    storeId,
    orderId: cashId,
    destination: { kind: "takeaway" },
  })
  await owner.mutation(api.orders.startCooking, { storeId, orderId: cashId })
  expect(
    (await owner.query(api.orders.detail, { storeId, orderId: cashId })).order
      .status
  ).toBe("cooking")
})

test("a signed provider confirmation unlocks a durable guest MMQR bill once and updates money reports", async () => {
  localPayments()
  const { t, owner, storeId, tableId, lines } = await cafe()
  const token = "b".repeat(64)
  const orderId = await t.mutation(api.guestOrders.submit, {
    storeId,
    tableId,
    token,
    lines,
    note: "",
    paymentMethod: "mmqr",
  })
  const requestKey = crypto.randomUUID()
  const attemptId = await t.action(api.payments.startGuest, {
    token,
    requestKey,
  })
  expect(await t.action(api.payments.startGuest, { token, requestKey })).toBe(
    attemptId
  )
  const checkout = await t.query(api.payments.guestCheckout, { token })
  expect(checkout?.attempt).toMatchObject({
    status: "pending",
    simulated: true,
  })
  await t.mutation(internal.simulator.setOutcome, {
    attemptId,
    outcome: "succeeded",
    transactionId: "first-transaction",
  })
  const events = await t.query(internal.simulator.events, { attemptId })
  for (let i = 0; i < 2; i++) {
    const response = await signedEvent(t, events[0]!)
    expect(response.status).toBe(200)
  }
  const detail = await owner.query(api.orders.detail, { storeId, orderId })
  expect(detail.collections).toHaveLength(1)
  expect(detail.money).toMatchObject({ collected: 2500, due: 0, funded: true })
  expect(detail.collections[0]).toMatchObject({
    method: "mmqr",
    simulated: true,
    timeSource: "provider_completed",
  })
  expect(await owner.mutation(api.orders.soundBaseline, { storeId })).toContain(
    orderId
  )
  await owner.mutation(api.orders.startCooking, { storeId, orderId })
  expect((await t.query(api.guestOrders.track, { token }))?.order.status).toBe(
    "cooking"
  )
  const dates = await owner.query(api.reports.dates, {
    storeId,
    refresh: crypto.randomUUID(),
  })
  expect(
    await owner.query(api.reports.summary, {
      storeId,
      kind: "day",
      key: dates.day,
    })
  ).toMatchObject({ collected: 2500, unpaidAmount: 0 })
})

async function signedEvent(
  t: ReturnType<typeof backend>,
  event: unknown,
  secret = "local-test-only-payment-event-signing-key"
) {
  const body = JSON.stringify(event)
  const timestamp = String(Date.now())
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = Array.from(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${timestamp}.${body}`)
      )
    ),
    (b) => b.toString(16).padStart(2, "0")
  ).join("")
  return t.fetch("/order-payment-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Timestamp": timestamp,
      "X-Payment-Signature": signature,
    },
    body,
  })
}

test("late and genuine extra confirmations remain collected, surface owner review, and resolve only through full refund records", async () => {
  localPayments()
  const { t, owner, storeId, tableId, lines } = await cafe()
  const token = "c".repeat(64)
  const orderId = await t.mutation(api.guestOrders.submit, {
    storeId,
    tableId,
    token,
    lines,
    note: "",
    paymentMethod: "mmqr",
  })
  const attemptId = await t.action(api.payments.startGuest, {
    token,
    requestKey: crypto.randomUUID(),
  })
  await owner.mutation(api.orders.cancel, {
    storeId,
    orderId,
    reason: "Customer left",
    requestKey: crypto.randomUUID(),
  })
  for (const transactionId of ["late-one", "late-two"]) {
    await t.mutation(internal.simulator.setOutcome, {
      attemptId,
      outcome: "succeeded",
      transactionId,
    })
    for (const event of await t.query(internal.simulator.events, { attemptId }))
      expect((await signedEvent(t, event)).status).toBe(200)
  }
  expect(
    await owner.query(api.payments.reviewSummary, { storeId })
  ).toMatchObject({ ready: true, count: 1 })
  const page = await owner.query(api.payments.review, {
    storeId,
    paginationOpts: { cursor: null, numItems: 10 },
  })
  expect(page.page.map((order) => order._id)).toEqual([orderId])
  const detail = await owner.query(api.orders.detail, { storeId, orderId })
  expect(detail.order.status).toBe("cancelled")
  expect(detail.money).toMatchObject({
    collected: 5000,
    retained: 5000,
    due: 0,
  })
  for (const collection of detail.collections) {
    await owner.mutation(api.orders.recordRefund, {
      storeId,
      orderId,
      collectionId: collection._id,
      reason: "Returned test payment",
      requestKey: crypto.randomUUID(),
    })
  }
  expect(
    await owner.query(api.payments.reviewSummary, { storeId })
  ).toMatchObject({ count: 0 })
  const refunded = await owner.query(api.orders.detail, { storeId, orderId })
  expect(refunded.refunds.every((r) => r.simulated)).toBe(true)
  const guest = await t.query(api.guestOrders.track, { token })
  expect(guest?.money).toMatchObject({
    collected: 5000,
    refunded: 5000,
    due: 0,
  })
  expect(JSON.stringify(guest)).not.toContain("Customer left")
  expect(JSON.stringify(guest)).not.toContain("late-one")
})

test("checkout recovers concurrent starts and uncertain status before replacement, including success on an expired attempt", async () => {
  localPayments()
  const { t, owner, storeId, lines } = await cafe()
  const orderId = await owner.mutation(api.orders.createCounter, {
    storeId,
    lines,
    note: "",
    submissionKey: crypto.randomUUID(),
    paymentMethod: "mmqr",
  })
  const args = { storeId, orderId }
  const keys = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
  const ids = await Promise.all(
    keys.map((requestKey) =>
      owner.action(api.payments.startCounter, {
        ...args,
        requestKey,
      })
    )
  )
  expect(new Set(ids).size).toBe(1)
  const attemptId = ids[0]!
  await t.mutation(internal.simulator.setOutcome, {
    attemptId,
    outcome: "uncertain",
  })
  await owner.action(api.payments.checkCounter, args)
  expect(
    (await owner.query(api.payments.counterCheckout, args)).attempt?.status
  ).toBe("uncertain")
  expect(
    await owner.action(api.payments.startCounter, {
      ...args,
      requestKey: crypto.randomUUID(),
    })
  ).toBe(attemptId)
  await t.mutation(internal.simulator.setOutcome, {
    attemptId,
    outcome: "expired",
  })
  await owner.action(api.payments.checkCounter, args)
  expect(
    await owner.action(api.payments.startCounter, {
      ...args,
      requestKey: keys[1]!,
    })
  ).toBe(attemptId)
  const replacement = await owner.action(api.payments.startCounter, {
    ...args,
    requestKey: crypto.randomUUID(),
  })
  expect(replacement).not.toBe(attemptId)
  await t.mutation(internal.simulator.setOutcome, {
    attemptId,
    outcome: "succeeded",
    transactionId: "late-expired",
  })
  await signedEvent(
    t,
    (await t.query(internal.simulator.events, { attemptId })).at(-1)!
  )
  expect((await owner.query(api.orders.detail, args)).money.funded).toBe(true)
  await owner.mutation(api.orders.assignDestination, {
    ...args,
    destination: { kind: "takeaway" },
  })
  await owner.mutation(api.orders.startCooking, args)
  expect((await owner.query(api.orders.detail, args)).order.status).toBe(
    "cooking"
  )
  await t.mutation(internal.simulator.setOutcome, {
    attemptId: replacement,
    outcome: "succeeded",
    transactionId: "excess",
  })
  await owner.action(api.payments.checkCounter, args)
  expect((await owner.query(api.orders.detail, args)).money.collected).toBe(
    5000
  )
  expect(
    await owner.query(api.payments.reviewSummary, { storeId })
  ).toMatchObject({ count: 1 })
})

test("ingestion rejects forged and mismatched money, deduplicates semantic retries, and never downgrades confirmed success", async () => {
  localPayments()
  const { t, owner, storeId, tableId, lines } = await cafe()
  const token = "d".repeat(64)
  const orderId = await t.mutation(api.guestOrders.submit, {
    storeId,
    tableId,
    token,
    lines,
    note: "",
    paymentMethod: "mmqr",
  })
  const attemptId = await t.action(api.payments.startGuest, {
    token,
    requestKey: crypto.randomUUID(),
  })
  await t.mutation(internal.simulator.setOutcome, {
    attemptId,
    outcome: "succeeded",
  })
  const event = (await t.query(internal.simulator.events, { attemptId }))[0]!
  expect((await signedEvent(t, event, "forged-key")).status).toBe(403)
  for (const override of [
    { merchant: "other" },
    { purpose: "subscription" },
    { currency: "USD" },
    { amount: 2501 },
    { reference: "unknown" },
    { completedAt: Date.now() + 100000 },
    { completedAt: 1 },
  ])
    expect((await signedEvent(t, { ...event, ...override })).status).toBe(400)
  expect(
    (await owner.query(api.orders.detail, { storeId, orderId })).money.collected
  ).toBe(0)
  expect((await signedEvent(t, event)).status).toBe(200)
  expect(
    (await signedEvent(t, Object.fromEntries(Object.entries(event).reverse())))
      .status
  ).toBe(200)
  expect((await signedEvent(t, { ...event, amount: 1 })).status).toBe(400)
  expect(
    (await signedEvent(t, { ...event, eventId: "duplicate-notification" }))
      .status
  ).toBe(200)
  expect(
    (
      await signedEvent(t, {
        ...event,
        eventId: "bad-time",
        completedAt: event.completedAt! - 1,
      })
    ).status
  ).toBe(400)
  await t.mutation(internal.simulator.setOutcome, {
    attemptId,
    outcome: "failed",
  })
  await t.action(api.payments.checkGuest, { token })
  expect(
    (await t.query(api.payments.guestCheckout, { token })).attempt?.status
  ).toBe("succeeded")
  expect(
    (await owner.query(api.orders.detail, { storeId, orderId })).collections
  ).toHaveLength(1)
})

test("simulation requires explicit opt-in and all local deployment URLs, with private-capability and store access checks", async () => {
  localPayments()
  const { t, owner, storeId, tableId, lines } = await cafe()
  const token = "e".repeat(64)
  const orderId = await t.mutation(api.guestOrders.submit, {
    storeId,
    tableId,
    token,
    lines,
    note: "",
    paymentMethod: "mmqr",
  })
  const stranger = await authenticate(t, `${crypto.randomUUID()}@example.com`)
  await expect(
    stranger.action(api.payments.startCounter, {
      storeId,
      orderId,
      requestKey: crypto.randomUUID(),
    })
  ).rejects.toThrow("STORE_ACCESS_DENIED")
  await expect(
    t.action(api.payments.startGuest, {
      token: "f".repeat(64),
      requestKey: crypto.randomUUID(),
    })
  ).rejects.toThrow("ORDER_ACCESS_DENIED")
  await expect(
    t.query(api.payments.reviewSummary, { storeId })
  ).rejects.toThrow()
  for (const [name, url] of [
    ["CONVEX_CLOUD_URL", "https://hosted.convex.cloud"],
    ["CONVEX_SITE_URL", "https://prod.convex.site"],
    ["SITE_URL", "https://example.com"],
    ["ORDER_PAYMENT_SIMULATOR", "disabled"],
  ]) {
    const prior = process.env[name!]
    vi.stubEnv(name!, url!)
    expect(await t.query(api.payments.capabilities, {})).toEqual({
      simulator: false,
    })
    await expect(
      t.action(api.payments.startGuest, {
        token,
        requestKey: crypto.randomUUID(),
      })
    ).rejects.toThrow("SIMULATOR_DISABLED")
    expect((await signedEvent(t, {})).status).toBe(404)
    await expect(
      t.query(internal.simulator.attempts, { orderId })
    ).rejects.toThrow("SIMULATOR_DISABLED")
    vi.stubEnv(name!, prior)
  }
  expect(
    await owner.query(api.payments.reviewSummary, { storeId })
  ).toMatchObject({ count: 0 })
})

test("current staff can check but cannot record outcomes or review money; confirmed funding and refunds remain atomic after expiry", async () => {
  localPayments()
  const { t, owner, storeId, tableId, lines } = await cafe()
  const invite = await owner.action(api.staff.createJoinLink, { storeId })
  const staff = await authenticate(t, `${crypto.randomUUID()}@example.com`)
  await staff.mutation(api.staff.accept, { token: invite.token })
  const orderId = await staff.mutation(api.orders.createCounter, {
    storeId,
    lines,
    note: "",
    submissionKey: crypto.randomUUID(),
    paymentMethod: "mmqr",
  })
  const args = { storeId, orderId }
  const attemptId = await staff.action(api.payments.startCounter, {
    ...args,
    requestKey: crypto.randomUUID(),
  })
  await expect(
    staff.query(api.payments.reviewSummary, { storeId })
  ).rejects.toThrow("OWNER_REQUIRED")
  await expect(
    staff.query(api.payments.review, {
      storeId,
      paginationOpts: { numItems: 10, cursor: null },
    })
  ).rejects.toThrow("OWNER_REQUIRED")
  await t.run(async (ctx) => {
    await ctx.db.patch(storeId, { trialEndsAt: Date.now() - 1 })
  })
  await t.mutation(internal.simulator.setOutcome, {
    attemptId,
    outcome: "succeeded",
    omitCompletionTime: true,
  })
  await staff.action(api.payments.checkCounter, args)
  const first = await owner.query(api.orders.detail, args)
  expect(first.collections[0]?.timeSource).toBe("verification_fallback")
  await staff.mutation(api.orders.assignDestination, {
    ...args,
    destination: { kind: "table", tableId },
  })
  await staff.mutation(api.orders.startCooking, args)
  await expect(
    staff.mutation(api.orders.recordRefund, {
      ...args,
      collectionId: first.collections[0]!._id,
      requestKey: crypto.randomUUID(),
      reason: "Returned",
    })
  ).rejects.toThrow("OWNER_REQUIRED")
  await owner.mutation(api.orders.cancel, {
    ...args,
    requestKey: crypto.randomUUID(),
    reason: "Closed",
  })
  await t.mutation(internal.simulator.setOutcome, {
    attemptId,
    outcome: "succeeded",
    transactionId: "after-cancel",
  })
  const event = (await t.query(internal.simulator.events, { attemptId })).at(
    -1
  )!
  const refund = {
    ...args,
    collectionId: first.collections[0]!._id,
    requestKey: crypto.randomUUID(),
    reason: "Returned",
  }
  await Promise.all([
    signedEvent(t, event),
    owner.mutation(api.orders.recordRefund, refund),
    owner.mutation(api.orders.recordRefund, refund),
  ])
  expect((await owner.query(api.orders.detail, args)).money).toMatchObject({
    collected: 5000,
    refunded: 2500,
    retained: 2500,
    due: 0,
  })
  expect(
    await owner.query(api.payments.reviewSummary, { storeId })
  ).toMatchObject({ count: 1 })
  const membership = (await owner.query(api.staff.directory, { storeId }))
    .members[0]!
  await owner.mutation(api.staff.remove, {
    storeId,
    membershipId: membership._id,
  })
  await expect(staff.action(api.payments.checkCounter, args)).rejects.toThrow(
    "STORE_ACCESS_DENIED"
  )
})

test("bounded review backfill preserves legacy cash and concurrent live contributions across restarts", async () => {
  localPayments()
  vi.useFakeTimers()
  const { t, owner, storeId, lines } = await cafe()
  const email = (await owner.query(api.stores.workspace, {})).user.email
  const orderId = await owner.mutation(api.orders.createCounter, {
    storeId,
    lines,
    note: "",
    submissionKey: crypto.randomUUID(),
  })
  await owner.mutation(api.orders.cancel, {
    storeId,
    orderId,
    reason: "Legacy cancellation",
    requestKey: crypto.randomUUID(),
  })
  const seed = (await owner.query(api.orders.detail, { storeId, orderId }))
    .order
  await t.run(async (ctx) => {
    const state = await ctx.db
      .query("reportStates")
      .withIndex("by_store", (q) => q.eq("storeId", storeId))
      .unique()
    await ctx.db.patch(state!._id, {
      paymentReviewReady: undefined,
      paymentReviewCount: undefined,
    })
    const { _id, _creationTime, ...fields } = seed
    await ctx.db.patch(_id, { paymentReviewRequired: undefined })
    const ids = [_id]
    for (let i = 1; i < 105; i++)
      ids.push(
        await ctx.db.insert("orders", {
          ...fields,
          createdAt: fields.createdAt + i,
          submissionKey: `legacy-review-${i}`,
          paymentReviewRequired: undefined,
          cancellation: {
            ...fields.cancellation!,
            requestKey: `legacy-cancel-${i}`,
          },
        })
      )
    for (const id of ids)
      await ctx.db.insert("cashPayments", {
        storeId,
        orderId: id,
        amount: 2500,
        receivedAt: Date.now(),
        recordedBy: "original-cashier",
      })
  })
  expect(
    await owner.query(api.payments.reviewSummary, { storeId })
  ).toMatchObject({ ready: false })
  await t.mutation(internal.reports.backfill, { storeId })
  const live = await owner.mutation(api.orders.createCounter, {
    storeId,
    lines,
    note: "",
    submissionKey: crypto.randomUUID(),
  })
  await owner.mutation(api.orders.recordCash, { storeId, orderId: live })
  await owner.mutation(api.orders.cancel, {
    storeId,
    orderId: live,
    reason: "Live cancellation",
    requestKey: crypto.randomUUID(),
  })
  await t.mutation(internal.reports.backfill, { storeId })
  await t.finishAllScheduledFunctions(() => vi.advanceTimersToNextTimer())
  const refreshed = await authenticate(t, email, false)
  expect(
    await refreshed.query(api.payments.reviewSummary, { storeId })
  ).toMatchObject({ ready: true, count: 106 })
  const dates = await refreshed.query(api.reports.dates, {
    storeId,
    refresh: "backfill",
  })
  const historical = new Date(seed.createdAt + 23400000)
    .toISOString()
    .slice(0, 10)
  expect(
    await refreshed.query(api.reports.summary, {
      storeId,
      kind: "day",
      key: historical,
    })
  ).toMatchObject({ collected: 265000, unpaidAmount: 0 })
  expect(dates.day).not.toBe(historical)
  const first = await refreshed.query(api.payments.review, {
    storeId,
    paginationOpts: { cursor: null, numItems: 100 },
  })
  const second = await refreshed.query(api.payments.review, {
    storeId,
    paginationOpts: { cursor: first.continueCursor, numItems: 100 },
  })
  expect(
    new Set([...first.page, ...second.page].map((order) => order._id)).size
  ).toBe(106)
})

test("the server deadline requires provider reconciliation and late success remains valid without a downgrade", async () => {
  localPayments()
  vi.useFakeTimers()
  const { t, owner, storeId, tableId, lines } = await cafe()
  const token = "9".repeat(64)
  const orderId = await t.mutation(api.guestOrders.submit, {
    storeId,
    tableId,
    token,
    lines,
    note: "",
    paymentMethod: "mmqr",
  })
  const requestKey = "deadline-original"
  const attemptId = await t.action(api.payments.startGuest, {
    token,
    requestKey,
  })
  const initial = (await t.query(api.payments.guestCheckout, { token }))
    .attempt!
  expect(initial.expiresAt - Date.now()).toBe(900000)
  vi.advanceTimersByTime(900000)
  await t.finishInProgressScheduledFunctions()
  expect(
    (await t.query(api.payments.guestCheckout, { token })).attempt
  ).toMatchObject({ status: "expired", reconciled: false })
  await t.mutation(internal.simulator.setOutcome, {
    attemptId,
    outcome: "uncertain",
  })
  expect(
    await t.action(api.payments.startGuest, {
      token,
      requestKey: "deadline-new-key",
    })
  ).toBe(attemptId)
  await t.mutation(internal.simulator.setOutcome, {
    attemptId,
    outcome: "succeeded",
    transactionId: "deadline-late",
  })
  await t.action(api.payments.checkGuest, { token })
  expect((await t.query(api.payments.guestCheckout, { token })).funded).toBe(
    true
  )
  expect(await t.action(api.payments.startGuest, { token, requestKey })).toBe(
    attemptId
  )
  await expect(
    t.action(api.payments.startGuest, { token, requestKey: "after-funded" })
  ).rejects.toThrow("PAYMENT_ALREADY_CONFIRMED")
  expect(
    (await owner.query(api.orders.detail, { storeId, orderId })).collections
  ).toHaveLength(1)
})

test("interrupted provider creation recovers the original attempt through authorized same-start commands", async () => {
  localPayments()
  const { t, owner, storeId, lines } = await cafe()
  const orderId = await owner.mutation(api.orders.createCounter, {
    storeId,
    lines,
    note: "",
    submissionKey: crypto.randomUUID(),
    paymentMethod: "mmqr",
  })
  const args = { storeId, orderId, requestKey: "interrupted-start" }
  await t.mutation(internal.simulator.creation, { available: false })
  await expect(owner.action(api.payments.startCounter, args)).rejects.toThrow(
    "CHECKOUT_UNCERTAIN"
  )
  const original = (
    await owner.query(api.payments.counterCheckout, { storeId, orderId })
  ).attempt!
  expect(original.status).toBe("uncertain")
  await owner.action(api.payments.checkCounter, { storeId, orderId })
  await t.mutation(internal.simulator.creation, { available: true })
  expect(await owner.action(api.payments.startCounter, args)).toBe(original._id)
  expect(
    (await owner.query(api.payments.counterCheckout, { storeId, orderId }))
      .attempt
  ).toMatchObject({ _id: original._id, status: "pending" })
})
