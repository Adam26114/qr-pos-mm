# QR Menu and POS: Implementation Tickets

Status: Approved and published. Parent specification: [#1](https://github.com/Adam26114/qr-pos-mm/issues/1). All thirteen implementation tickets are open and labelled `ready-for-agent`; their fifteen native GitHub blocking relationships were verified.

Each ticket is a vertical slice with backend behavior, usable UI, and focused verification. Shared acceptance rules apply from the first relevant slice: backend permission and store-isolation checks, Convex queries as realtime truth, Redux only for transient state, Burmese/English system text with verbatim menu content, online-only operation, and idempotent commands where retries affect orders or money. Add focused Playwright coverage for each user journey and public-operation tests for consequential rules; do not defer security or localization to a cleanup ticket.

Section numbers below refer to the approved plan. GitHub issue links and blocker links use the real published issue numbers. Dependencies list direct prerequisites; inherited dependencies do not need repeating.

## 1. Owner signup creates one store and starts its trial

**GitHub issue:** [#2](https://github.com/Adam26114/qr-pos-mm/issues/2)

**Blocked by:** None (can start immediately).

**What it delivers:** An owner registers with email/password, signs in, creates one store, and sees a protected owner workspace with its trial end and active/expired access state.

- [ ] Integrate the chosen Convex backend and Better Auth stack with the existing web workspace; provide working signup, login, logout, and password recovery through the auth/email boundary.
- [ ] Store creation atomically establishes the owner membership and one 14-day trial. Repeat submissions return the same store and never restart the trial.
- [ ] A private store query rejects guests and accounts from another store; membership rather than client-supplied role determines access.
- [ ] Provide the reusable authoritative entitlement check used by all later new-order commands. Expiry is based on server time; it does not erase the workspace or historical access.
- [ ] Establish Burmese/English interface selection and responsive authenticated screens without introducing translated menu fields.
- [ ] Establish the behavior-focused test harness, captured email delivery, controllable test clock, and a Playwright owner journey. Verify singleton creation, isolation, and exact trial boundaries.

## 2. Owner invites and removes individual staff

**GitHub issue:** [#3](https://github.com/Adam26114/qr-pos-mm/issues/3)

**Blocked by:** [#2](https://github.com/Adam26114/qr-pos-mm/issues/2)

**What it delivers:** An owner sends a store-specific invitation; the staff member accepts into an individual account and sees the operational workspace. The owner can remove that access.

- [ ] Invitations bind a store and email, expire, and cannot be reused; acceptance validates identity and does not create an owner store or trial.
- [ ] Staff can sign in/out and recover their own account access without sharing owner credentials.
- [ ] The owner can see membership state and revoke staff access, which is enforced by current backend membership checks even in an open session.
- [ ] Staff cannot invoke owner settings, menu management, member management, or billing operations. Later capabilities inherit this role boundary.
- [ ] Verify invitation lifecycle, cross-store/conflicting membership handling, revoked-session behavior, and separate owner/staff browser contexts.

## 3. Owner manages a single-price menu

**GitHub issue:** [#4](https://github.com/Adam26114/qr-pos-mm/issues/4)

**Blocked by:** [#2](https://github.com/Adam26114/qr-pos-mm/issues/2)

**What it delivers:** An owner maintains categories, items, photos, final prices, and availability, with a persistent menu preview.

- [ ] Support owner-entered names, optional descriptions/photos, categories, one positive whole-MMK item price, and availability.
- [ ] Category/item labels and descriptions remain unchanged when the system language switches; no bilingual content requirement or automatic translation exists.
- [ ] Allow price changes, availability changes, and removal from sale, while designing historical references to survive removal.
- [ ] Validate image access and ownership; reject guest, staff, and other-store writes at the backend boundary.
- [ ] Preview and editing views reflect authoritative Convex queries. Verify persistence, Unicode text, validation, and owner-only access through the public boundary and browser flow.

## 4. Publish the shared store QR menu and numbered tables

**GitHub issue:** [#5](https://github.com/Adam26114/qr-pos-mm/issues/5)

**Blocked by:** [#4](https://github.com/Adam26114/qr-pos-mm/issues/4)

**What it delivers:** The owner configures table numbers and downloads the store's one menu QR. Any guest can open it and browse the menu and final prices without an account.

- [ ] Provide owner-only numbered-table management, retaining historical references for later orders.
- [ ] Publish one stable store-menu URL and downloadable/printable QR; it has no table or payment identity embedded.
- [ ] Expose only appropriate public store, menu, and active-table data, excluding memberships, merchant settings, and other private fields.
- [ ] Provide a phone-friendly menu with categories, photos, prices, availability, and Burmese/English interface strings, preserving owner-authored content.
- [ ] Verify logged-out browsing, store separation, QR destination correctness, and live menu/availability changes.

## 5. Seated guests submit cash orders and track them privately

**GitHub issue:** [#6](https://github.com/Adam26114/qr-pos-mm/issues/6)

**Blocked by:** [#5](https://github.com/Adam26114/qr-pos-mm/issues/5)

**What it delivers:** A guest chooses items/quantities/notes, reviews the cart, selects the table where they are seated, and submits one separate cash order with a private live tracking screen.

- [ ] Calculate totals server-side, validate the store's table and current menu, and require a new review when price or availability changed.
- [ ] Snapshot submitted names/prices, keep submitted item lines fixed, and create a separate bill for each submission even at the same table.
- [ ] Use the single order-level note consistently in review, private tracking where appropriate, and the operational view.
- [ ] Use a durable submission key so uncertain responses/reloads/retries resolve to one order; reject a key reused for different contents.
- [ ] Enforce active trial/paid access on new submissions from the outset. Return an existing accepted order on an idempotent retry after expiry; reject genuinely new orders.
- [ ] Expose only the guest's order via a private tracking capability retained in that browser, with a copyable tracking link. Table/order display numbers grant no access.
- [ ] Provide a minimal owner pending-order view so the submitted order is verifiable immediately; later operational controls build on this view.
- [ ] Verify server-side price authority, same-table separate bills, inaccessible other orders, immutable receipts, expiry, and reconnect without duplicate submission.

## 6. Staff prepares orders and records seated cash collection

**GitHub issue:** [#7](https://github.com/Adam26114/qr-pos-mm/issues/7)

**Blocked by:** [#3](https://github.com/Adam26114/qr-pos-mm/issues/3), [#6](https://github.com/Adam26114/qr-pos-mm/issues/6)

**What it delivers:** Owners and staff receive seated cash orders live, enable sound, start cooking, mark served, correct tables, and independently record cash received.

- [ ] Show items, quantities, notes, destination, payment, and preparation state from Convex queries; expose no aggregate revenue to staff.
- [ ] Permit pending to cooking to served transitions atomically, with cash QR preparation allowed before collection.
- [ ] Cash collection records a distinct money event exactly once, independent of whether an order is served.
- [ ] Allow audited table correction without changing item lines, totals, payment, or preparation history.
- [ ] Offer sound opt-in and visual new-order indicators; alert for newly actionable work without replaying history after reconnect.
- [ ] Allow accepted orders to finish and receive payment after store access expires; keep new submission gates intact.
- [ ] Verify guest/staff realtime convergence, concurrent actions, duplicate collection, role restrictions, expiry recovery, and audio/reconnect behavior.

## 7. Staff takes prepaid counter orders

**GitHub issue:** [#8](https://github.com/Adam26114/qr-pos-mm/issues/8)

**Blocked by:** [#7](https://github.com/Adam26114/qr-pos-mm/issues/7)

**What it delivers:** Staff enters a counter order, collects cash, then assigns a table or Takeaway before it joins preparation.

- [ ] Create a durable counter order with immutable items/total before collecting payment; initially it has no destination.
- [ ] Require confirmed cash collection before table/Takeaway assignment, and require both before Start Cooking.
- [ ] Keep unpaid and paid-but-unassigned counter orders clearly visible and recoverable after reload or disconnection.
- [ ] Reuse table corrections and the live preparation/serving flow; Takeaway records handover with no delivery feature.
- [ ] Apply subscription gates to new counter order creation, while allowing pre-expiry orders to be paid, assigned, and completed afterward.
- [ ] Verify both destination choices, all premature-action denials, lost-response recovery, concurrent assignment, and paid-unassigned recovery after expiry.

## 8. Owner cancels orders and records external full refunds

**GitHub issue:** [#9](https://github.com/Adam26114/qr-pos-mm/issues/9)

**Blocked by:** [#7](https://github.com/Adam26114/qr-pos-mm/issues/7)

**What it delivers:** Owners can stop pending/cooking orders with a reason and separately record completed full refunds, retaining accurate service and payment history.

- [ ] Only owners may cancel pending/cooking orders, with actor, time, and a required reason. Staff and guests cannot cancel through direct backend calls.
- [ ] Cancelled orders leave the cooking queue without removing the original order or claiming a refund.
- [ ] Record an external full refund against an actual collected payment, with method/reference, completion time, reason, and audit actor/time. Cash is returned physically; later MMQR refunds use the same record after external provider handling.
- [ ] Reject partial amounts, duplicate records, unsupported dates, and unpaid refunds. Refunds removing a pending/cooking order's required payment require prior cancellation. Refunding a genuine excess collection leaves a still-fully-funded order intact. Preserve timestamp provenance and flag uncertain chronology rather than rejecting a legitimate refund that preceded late payment verification.
- [ ] Preserve served status on a refunded served order; show collection and refund outcomes independently on authorized views.
- [ ] Verify permissions, duplicate protection, immutable history, and continued handling of pre-expiry orders.

## 9. Owner sees collected sales, refunds, net, and unpaid orders

**GitHub issue:** [#10](https://github.com/Adam26114/qr-pos-mm/issues/10)

**Blocked by:** [#9](https://github.com/Adam26114/qr-pos-mm/issues/9)

**What it delivers:** Owner-only today and calendar-month reports reconcile store money actually received, money returned, net collection, and outstanding unpaid orders.

- [ ] Use Asia/Yangon day/month boundaries and money-event times, not order submission or serving time.
- [ ] Display collected payments, completed refunds, and net separately, with traceable order/payment records.
- [ ] Show unpaid non-cancelled orders separately; cancelled unpaid orders remain in history but not amounts due.
- [ ] Preserve correct totals across duplicate handling, later-recorded events, and refunds in a different reporting period.
- [ ] Enforce owner-only aggregate queries and exclude platform subscription receipts, including after subscription expiry.
- [ ] Verify period boundaries, served-unpaid orders, cancellation/refund outcomes, and denied staff/cross-store report access.

## 10. Exercise customer MMQR orders with a development simulator

**GitHub issue:** [#11](https://github.com/Adam26114/qr-pos-mm/issues/11)

**Blocked by:** [#8](https://github.com/Adam26114/qr-pos-mm/issues/8)

**What it delivers:** In a clearly identified development/test environment, guests and counter staff can exercise online checkout and see verified payment unlock the correct next step without real provider access.

- [ ] Introduce the narrow server-side payment integration boundary through working order checkout, with persistent attempts/events bound to purpose, store merchant, order, currency, and amount.
- [ ] QR MMQR orders wait for confirmation before cooking. Counter MMQR orders wait for confirmation before destination assignment, then follow the same cooking gate as counter cash.
- [ ] Simulate success, failure, expiry, uncertain outcomes, duplicates, late confirmations, and real double-collection exceptions while retaining recoverable order state.
- [ ] Protect event ingestion, amount/reference matching, and deduplication at the backend boundary. A client action, displayed QR, or screenshot cannot assert success.
- [ ] Reconcile uncertain attempts before retrying payment; preserve genuine extra collections for owner attention rather than erasing them or fulfilling cancelled orders.
- [ ] Prevent production from enabling or accepting simulator events. Payment integration internals remain server-only; Convex queries carry resulting client state.
- [ ] Verify both browser flows, negative ingestion scenarios, role/tenant restrictions, and order recovery. The simulator does not count as live MMQR acceptance evidence.

## 11. Owner renews monthly access through simulated MMQR billing

**GitHub issue:** [#12](https://github.com/Adam26114/qr-pos-mm/issues/12)

**Blocked by:** [#11](https://github.com/Adam26114/qr-pos-mm/issues/11)

**What it delivers:** In development/test, an owner sees trial/expiry information, initiates a 30,000 MMK invoice, pays through the simulated platform merchant flow, and sees new ordering restored or access extended.

- [ ] Use a distinct subscription purpose and platform recipient account, separate from store order payments.
- [ ] Extend by one calendar month per verified invoice exactly once using first server verification time and serialized grant order, preserving remaining trial/paid time and defining lapse, anniversary, and short-month behavior as specified. Provider completion timestamps remain financial evidence and do not backdate access grants.
- [ ] Show renewal pending/failed/expired/confirmed states without granting access from an unverified invoice or QR.
- [ ] Preserve history, owner reporting, and completion of existing orders during expiry; confirmed renewal restores new QR and counter acceptance live.
- [ ] Guard concurrent, duplicate, wrong-purpose, wrong-amount, and late confirmations, including receipts accidentally sent through the order flow. A genuine late success for a valid uncredited invoice can grant access after local attempt expiry; voided/already-credited invoices route incoming money to reconciliation.
- [ ] Verify exact trial boundary, early renewal, lapse/reactivation, calendar/leap-year cases, reversed distinct-invoice notifications, and stale open tabs across expiry and renewal.

## 12. Connect real store MMQR payments

**GitHub issue:** [#13](https://github.com/Adam26114/qr-pos-mm/issues/13)

**Blocked by:** [#11](https://github.com/Adam26114/qr-pos-mm/issues/11); external provider documentation, sandbox/API access, and store merchant onboarding capability.

**What it delivers:** Customer QR and counter orders can pay the correct store merchant through the real MMQR provider, with verified confirmation controlling preparation and assignment.

- [ ] Review actual provider contracts for onboarding, per-store routing, payment creation, authentic confirmation/status queries, expiry, retries, and reconciliation before selecting implementation details.
- [ ] Connect the real adapter and owner-visible merchant readiness/configuration workflow supported by the provider; keep secrets server-only and scoped to the right store.
- [ ] Exercise real provider sandbox journeys for both order sources, including mismatched references/amounts, duplicate callbacks, delayed success, and uncertain states.
- [ ] Preserve the existing late-payment, cancellation, refund-recording, and overpayment behavior. Report a missing provider capability as a concrete integration blocker rather than simulating production success.
- [ ] Prepare the reviewable procedure and evidence for user-authorized real-money checks with the intended store merchant. Run those checks only when authorized.
- [ ] Re-estimate or split this ticket if actual provider requirements exceed one implementation session; do not assume a generic MMQR API exists.

## 13. Connect real subscription renewals and verify paid-launch readiness

**GitHub issue:** [#14](https://github.com/Adam26114/qr-pos-mm/issues/14)

**Blocked by:** [#10](https://github.com/Adam26114/qr-pos-mm/issues/10), [#12](https://github.com/Adam26114/qr-pos-mm/issues/12), [#13](https://github.com/Adam26114/qr-pos-mm/issues/13); external platform merchant access.

**What it delivers:** Real owner payments reach the platform merchant, restore/extend the correct store once, and both real payment flows have the evidence required before paid launch.

- [ ] Apply the verified real-provider adapter to platform subscription invoices with the separate merchant/purpose and owner-only UI.
- [ ] Verify pending/failure/retry/confirmation, preserved access time, duplicate handling, expiry recovery, and isolation from store collected-sales reports.
- [ ] Complete provider sandbox and user-authorized live verification for customer order payments and monthly renewal; retain transaction references and outcomes without exposing secrets.
- [ ] Verify the entire confirmed browser flow for owner, staff, and guest, including both system languages, unchanged menu content, counter seating recovery, refunds/reports, and online reconnect behavior.
- [ ] Verify production configuration rejects simulated payment/clock controls and has working authentication email and merchant integrations.
- [ ] Record remaining launch blockers explicitly. Passing simulator tests alone cannot satisfy the paid-launch gate; deployment and real-money checks require their own authorization.

## Approval

The user approved the public-backend and Playwright testing boundaries, the thirteen-ticket breakdown, and its direct blocking relationships, and explicitly requested GitHub publication.

The first eleven tickets can be built while real MMQR access is pending. Store isolation, role checks, and expiry gates are implemented with their first relevant behavior, not postponed until launch verification. Real-provider ticket sizing remains provisional until provider documentation and access are available.
