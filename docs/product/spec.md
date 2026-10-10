# QR Menu and POS SaaS: First Release

Status: Approved and published as [GitHub issue #1](https://github.com/Adam26114/qr-pos-mm/issues/1). The user approved the product scope, implementation defaults, testing boundaries, and thirteen-ticket breakdown.

## Problem Statement

Cafe and restaurant owners need an affordable service that lets seated customers order without accounts, lets staff take orders at the counter, and keeps the kitchen, payment records, and sales reports in agreement. Owners need to manage their own store and staff while keeping their data separate from other businesses.

Customers need visible prices, a straightforward ordering flow, and live order progress. Staff need an actionable queue and clear payment and table information. Owners need trustworthy collected-sales totals and a predictable monthly subscription.

## Solution

Provide one store per owner with one shared menu QR, guest ordering, a counter POS, a live preparation queue, and owner-only administration and reporting. Offer a 14-day trial from store creation and one plan costing 30,000 MMK monthly, manually renewed through MMQR.

Seated QR customers select items, review the cart, select their table, submit, and track the order. Their cash orders may be prepared before collection; their MMQR orders wait for verified payment before cooking. Counter customers pay first, then staff assigns a table or Takeaway before the order enters the cooking queue. Each submission has a separate bill, including orders sharing the same table.

The first release requires internet. Burmese/English switching translates system interface text; store-authored menu content is displayed as entered. Build and test the service while MMQR access is pending, then launch the paid service only after real customer payments and subscription renewals are verified.

## User Stories

1. As an owner, I want to register and sign in with email and password, so that I can operate my store securely.
2. As an owner, I want to recover access to my account, so that a forgotten password does not prevent store operations.
3. As an owner, I want to create my single store, so that my menu, staff, orders, and subscription belong to one business.
4. As an owner, I want my 14-day trial to start when the store is created, so that I can evaluate the service before paying.
5. As an owner, I want to invite individual staff accounts, so that workers can sign in without sharing my credentials.
6. As an invited staff member, I want to accept my invitation and sign in, so that I can work in the correct store.
7. As an owner, I want to remove staff access, so that former workers cannot continue operating my store.
8. As an owner, I want to manage menu categories, so that customers can browse the menu easily.
9. As an owner, I want to create menu items with a name, optional description, photo, and one price, so that customers understand what they can order.
10. As an owner, I want to update prices and availability, so that new orders reflect the current menu.
11. As an owner, I want to remove menu items from sale, so that customers cannot order discontinued items while historical orders remain readable.
12. As an owner, I want to configure numbered tables, so that customers and staff can identify where an order should be served.
13. As an owner, I want one shared menu QR to display or print, so that customers reach the same store menu from any table.
14. As a customer, I want to browse the menu and see final prices without an account, so that I can decide what to order immediately.
15. As a customer, I want to select quantities and enter notes, so that the store receives my intended order.
16. As a customer, I want to review my cart and select the table where I am seated, so that the order reaches the right place.
17. As a customer, I want to review price or availability changes before submission completes, so that I am not charged an unexpected total.
18. As a customer, I want one submission to create one order even when the connection is interrupted, so that retrying does not duplicate my bill.
19. As a customer, I want my own order and bill even when others use the same table number, so that our purchases remain separate.
20. As a customer, I want to pay a seated QR order in cash after eating, so that I can order before visiting the cashier.
21. As a customer, I want to pay my order through MMQR to the store's merchant account, so that I can use online payment.
22. As a customer, I want clear pending, failed, expired, and confirmed payment feedback, so that I know whether payment needs attention.
23. As a customer, I want to track my order's live preparation and payment information privately, so that I know what is happening without an account.
24. As a customer, I want to place another order for additional items, so that my already-submitted order stays accurate.
25. As a customer, I want to switch system instructions between Burmese and English, so that I can navigate comfortably while menu names remain as the owner wrote them.
26. As a staff member, I want a live queue with table numbers, items, quantities, notes, and payment status, so that I can prepare the correct orders.
27. As a staff member, I want an audio alert for newly actionable orders, so that I notice work while using the POS.
28. As a staff member, I want to start cooking and mark an order served, so that the customer's live status reflects progress.
29. As a staff member, I want the app to enforce payment prerequisites, so that unpaid counter and MMQR orders do not accidentally enter preparation.
30. As a staff member, I want to record cash received separately from service, so that serving a cash customer does not falsely record payment.
31. As a staff member, I want to enter a customer's counter order, so that customers who do not scan the menu can still order.
32. As a staff member, I want to collect counter payment before assigning a table or Takeaway, so that the POS follows the counter workflow.
33. As a staff member, I want to recover paid counter orders awaiting assignment after a reload, so that a completed payment never loses its order.
34. As a staff member, I want to correct table assignments, so that a seating mistake does not require editing item lines or collecting payment again.
35. As an owner, I want staff to have operational access without menu, billing, reporting, cancellation, or refund privileges, so that sensitive controls stay with me.
36. As an owner, I want to cancel pending or cooking orders with a reason, so that the store can stop orders it cannot fulfill.
37. As an owner, I want cancellation to remain separate from payment refunds, so that customers and staff see the actual financial outcome.
38. As an owner, I want to record a completed external full-order refund, so that financial reports reflect money returned.
39. As an owner, I want served orders to remain served after a refund, so that historical fulfillment remains accurate.
40. As an owner, I want today's collected payments, refunds, and net amount, so that I can understand actual money movement.
41. As an owner, I want monthly collected-sales reports, so that I can review store performance over time.
42. As an owner, I want unpaid orders shown separately, so that outstanding cash collection is visible without inflating sales.
43. As an owner, I want my remaining trial or paid period displayed, so that I know when renewal is due.
44. As an owner, I want to manually pay 30,000 MMK through MMQR for another month, so that I control subscription renewal.
45. As an owner, I want early renewal to preserve unused access time, so that paying early does not waste my trial or paid period.
46. As an owner, I want verified renewal to restore or extend access once, so that duplicate payment notifications do not corrupt my subscription.
47. As an owner, I want existing orders to remain finishable after expiry, so that subscription timing does not strand customers or paid orders.
48. As an owner, I want history and renewal screens available after expiry, so that I can inspect records and resume service.
49. As a customer or staff member, I want clear connection feedback and automatic reconnection, so that uncertain network state is not mistaken for a completed action.
50. As a staff member, I want concurrent actions on another device reflected live, so that the team works from the same order state.
51. As an owner, I want my store's data protected from other stores and guests, so that running a shared service does not expose business information.
52. As the service operator, I want customer payments and subscription payments routed and recorded separately, so that shop sales reach shops and subscription fees reach the platform.
53. As the service operator, I want development payment simulations kept out of production, so that tests cannot manufacture real paid status.
54. As the service operator, I want evidence that real MMQR ordering and renewal work before paid launch, so that customers receive a functioning payment service.

## Implementation Decisions

The following approved choices translate the confirmed scope into implementable rules. Technical defaults include time calculations, retry behavior, and alert timing.

### Application and state ownership

- Keep Next.js 16 App Router, React 19, TypeScript, Convex backend/database, Better Auth with `@convex-dev/better-auth`, shadcn/ui, Tailwind CSS, React Hook Form, Zod, Redux Toolkit, Bun, Turborepo, and Playwright. Add missing pieces to the existing workspace rather than replacing its foundations.
- Read the installed Next.js version's bundled guides before implementing framework code. Integrate Better Auth using the supported Convex integration and current primary documentation; do not invent framework or provider APIs.
- Use Convex queries for authoritative live menus, orders, payments, membership, subscription state, and reports. Mutations enforce business rules; provider I/O runs in server-side integration functions with authenticated event ingestion and reconciliation.
- Redux holds transient UI state, such as an unsent cart and local selections. Never copy Convex query results into Redux. React Hook Form and Zod validate forms, with all relevant validation repeated at the backend trust boundary.
- Build responsive web experiences for guest phones and owner/staff phone, tablet, and desktop browsers. Domain responsibilities are accounts/access, catalog/tables, ordering/fulfillment, payments/refunds, subscription access, and reporting; keep their public operations narrow without introducing extra services.

### Accounts, stores, and permissions

- Atomically create one store and owner membership per owner, with a single durable trial start. Retrying creation returns the existing result. Staff invitation acceptance does not create a store or a trial.
- Invitations are store-bound, email-bound, expiring, and single-use. Provide sign-in, sign-out, and secure password recovery with real email delivery configured before launch and a captured mail transport for tests.
- Scope every private operation to the authenticated membership and store, with current role checks in backend functions. Revoking membership removes operational access even for an already-open tab.
- For this release, account onboarding has one active store context; conflicting cross-store invitations are rejected clearly. Do not expose a multi-store switcher or multi-store creation.
- Owners manage store settings, numbered tables, menu content, staff, billing, cancellation, refund records, and reports, and can perform all staff operations.
- Staff can view operational menu/order data, create counter orders, receive cash, update fulfillment, and correct tables. They cannot modify menus/prices, manage users/billing, see aggregate revenue, cancel orders, record refunds, or manually mark MMQR paid.
- Guests can read only published menu/table data and their own order through an unguessable tracking capability. A table number or a predictable display order number is not an access credential. Neither guests nor ordinary query clients receive merchant secrets.

### Menu, shared QR, and tables

- Use a stable public store URL behind one shared menu QR, with a downloadable/printable QR asset. The menu QR contains no guest tracking token, table identity, or payment credentials.
- Owners maintain valid numbered tables. QR guests select a table from the active store list; this is seating identification, not a reservation or proof of physical presence. Multiple orders may use the same table.
- Store item names, descriptions, category labels, and customer notes as authored. Only system strings change with interface language; no duplicate language fields or machine translation are required.
- Items have one positive whole-MMK price, category, optional photo/description, and availability. Validate image ownership and access. Remove/archive offerings from future sale while preserving past order snapshots.
- Calculate totals server-side from current menu data using integer currency amounts and positive integer quantities. Show final prices with no added fees, tax controls, discounts, tips, or item options in this release.
- At submission, detect changed prices, invalid table choices, and removed/unavailable items and require an updated review instead of silently changing the bill. Persist item-name and unit-price snapshots on accepted orders.

### Orders and independent state

Maintain fulfillment, collection, payment attempts, and destination independently rather than forcing every combination into one status. The order source distinguishes QR and counter behavior.

| Order condition | Can start cooking? | Next action |
| --- | --- | --- |
| QR cash, valid selected table, pending | Yes, before cash collection | Start Cooking; cash may be collected after eating |
| QR MMQR, payment unconfirmed | No | Await authenticated payment confirmation |
| QR MMQR, paid and pending | Yes | Start Cooking |
| Counter order, unpaid | No | Collect cash or confirm MMQR |
| Counter order, paid but no table/Takeaway | No | Staff assigns destination |
| Counter order, paid and destination assigned | Yes | Start Cooking |
| Cancelled order | No | Preserve history and resolve any money owed |
| Served order | Already completed | Cash collection or refund recording remains separate |

- Create a durable immutable order before initiating payment. The submission idempotency key survives reconnects, reloads, and uncertain responses; reusing the same key for different content is rejected.
- QR submission requires the selected table and payment method. Counter submission initially has no destination; after payment staff chooses a table or Takeaway. A paid-but-unassigned counter order remains prominently visible and recoverable.
- Fulfillment advances pending to cooking to served, with owner-only cancellation from pending or cooking and a required reason. For takeaway, the service-completion action records handover without introducing delivery tracking.
- An order enters the actionable cooking queue only when its source-specific payment and destination gates are met. Awaiting-payment and awaiting-assignment orders remain separately visible to operators.
- Enforce allowed transitions atomically, including concurrent staff actions. Submitted item lines and totals are immutable; additional items require another order. Correcting a table is a separate audited operation and cannot reset payment or fulfillment.
- Note scope: one optional order-level note for either source, visible in review and the operational queue. Preserve its authored text with bounded input validation; per-item notes and structured modifiers are outside this initial default.
- Cash QR orders can be paid while pending, cooking, or served, even though pay-after-eating is the normal journey. Counter cash requires collection before destination assignment and cooking. Repeated cash clicks produce one collection event.
- Guests retain private tracking access after submission and reload in the same browser. Show a copyable tracking link; no customer account or cross-device identity system is introduced. Expose only that order's necessary status, bill, and payment feedback, not internal notes or other tables' orders.
- Limit unauthenticated order abuse and repeated submissions without customer registration. Shared QR ordering does not claim to verify that a customer is physically in the store.

### MMQR and cash payment records

- Persist orders, payment attempts, confirmed money events, and subscription invoices as distinct records. Bind each payment to a purpose, recipient merchant, order or invoice, currency, and expected amount.
- The same logical payment boundary supports a development/test simulator and a future real provider adapter. Simulated screens and events are clearly identified in development; production cannot load or accept the simulator or a client assertion of payment success.
- A provider-created QR, redirect, screenshot, or customer assertion alone never confirms payment. Use the actual provider's authenticated confirmation/status contract and verify merchant, reference, currency, amount, and successful status.
- Customer payments go to that store's merchant account; subscription payments go to the platform account. Keep server-only credentials scoped to the appropriate merchant and purpose. Merchant onboarding and callback capabilities must be verified once provider access arrives.
- Failed or expired attempts do not mark an order paid. Reconcile uncertain attempts before creating replacements; all attempts remain linked to the immutable order. Do not offer silent method switching that could cause a late MMQR payment and a cash payment to collect the same bill twice.
- Deduplicate notifications by provider transaction identity. Two notifications for one transaction are one collection; two actual successful transactions are two money movements and require overpayment attention, not silent deletion.
- A late success after cancellation or a local timeout remains a recorded collection and a reconciliation/refund concern. It cannot reopen a cancelled order or restart cooking.

### Cancellations, refunds, and history

- Owner cancellation records actor, timestamp, and reason and stops fulfillment. It does not change payment history or automatically claim that money was returned.
- Owners record completed external full refunds with payment reference, method, amount, completion time, reason, and audit recording time. MMQR money is returned through the provider; cash is returned physically and recorded. The record is an owner attestation, not an invented provider confirmation.
- Refund records require an actual collection and refund the whole applicable order payment. Reject partial amounts, repeated recording of the same refund, and refunds against unpaid orders. Genuine duplicate collections can be reconciled individually; do not represent a duplicate collection as one larger required bill.
- Refunding a served order preserves served status. Refunding the required payment of a pending/cooking order requires cancellation first so refunded work does not continue accidentally. Returning an excess collection while a valid full required payment remains is reconciliation and does not cancel fulfillment. Preserve history rather than deleting financial or fulfillment records.

### Reporting defaults

- Use Asia/Yangon day and calendar-month boundaries. Show collected money, completed refunds, net collected minus refunded, and collectible unpaid orders separately. Subscription receipts never enter a store's sales totals.
- Cash collection uses the server's recorded collection time. MMQR uses authenticated provider completion time if available, with documented verification-time fallback and retained timestamp provenance. Refund reporting uses recorded external completion time with separate audit recording time.
- Late confirmations or recorded refunds may correct the applicable historical period. Reject invalid future completion dates and refunds preceding a known actual collection time. When the collection time is only a verification fallback, an earlier external refund is uncertain chronology for review, not automatically invalid: verification may have happened after the money was collected and returned. The specification describes operational cash reporting, not a general accounting or tax system.
- Exclude cancelled unpaid orders from amounts still due while retaining them in history. Keep genuinely outstanding seated cash orders visible after service. A cancelled order that later receives MMQR remains a real collection requiring a refund decision.
- Derive reports from authoritative money events, with indexes or safe maintained aggregates as necessary. Staff are denied report queries at the backend boundary.

### Subscription and expiry defaults

- Trial access lasts exactly 14 days from successful store creation. Access is active while server time is earlier than the entitlement end. A retry or staff invitation does not restart the trial.
- Each verified 30,000 MMK subscription invoice purchases one calendar month. Manual payment replaces automatic debit; selecting a plan or viewing a QR does not activate access.
- Extend access from the later of the current entitlement end and the server time when this valid invoice payment is first verified. Persist that verification time and apply each invoice atomically once in verification order; delayed/reordered provider completion timestamps do not backdate access or recompute previously granted periods. This gives a late verified payment its full purchased access rather than a partly expired month. Financial reporting still retains the provider's actual completion time when known.
- Use a Yangon calendar-month anniversary, retaining its day-of-month anchor across short-month clamping. Reactivation after a lapse starts a new anniversary at first verification; early verified renewal preserves remaining trial/paid time. Duplicate notifications cannot change the recorded verification time, anchor, or grant; distinct concurrent verified invoices each extend access once.
- Gate new QR and counter order creation in the backend at the time of acceptance, including sessions opened before expiry. An idempotent retry of an already-accepted order returns it instead of creating a second order or claiming it was never accepted.
- Orders accepted before expiry can still receive payment, obtain a counter destination, cook, be served, be cancelled, or have refunds recorded afterward. Keep history, reports for owners, and subscription renewal accessible. Staff do not gain billing privileges after expiry.
- Keep the public menu readable after expiry with clear ordering-unavailable feedback. Permit settings/menu maintenance for authorized users; paid access controls new order acceptance rather than hiding existing records. Confirmed renewal restores acceptance automatically.
- An attempt's pending/failure/expiry state alone grants nothing. A later authenticated successful payment for a still-valid invoice grants its month once even if the local QR or attempt had expired. If an invoice was explicitly voided or was already credited, record any genuine incoming money for reconciliation instead of losing it or granting duplicate access. Genuine duplicate invoice payments must be reconciled explicitly; the same invoice cannot grant multiple months.

### Realtime, connectivity, and sound

- Convex subscriptions update the operational queue, private guest tracking, and other live views. Backend checks remain authoritative even if a screen is stale.
- Require online operation. Show disconnect/reconnect feedback and disable new authoritative actions while offline. Preserve unsent local input plus minimal retry/access metadata such as the submission key and private tracking capability; this is not a replica of Convex query results. Do not implement a durable offline submission queue. An uncertain in-flight submission is reconciled by its idempotency key when connectivity returns.
- Offer an explicit Enable sound control and a persistent visual queue. Alert once per newly actionable order per browser session; initial history load and reconnect do not replay every previous order. Audio is best-effort in an active browser, not a promised background push or native alarm.
- Keep authentication, validation errors, payment feedback, statuses, and connection messages localized. Language changes preserve unsent cart input and owner-authored text.

## Testing Decisions

Approved testing boundaries:

1. **Public Convex operations and authenticated event ingestion:** exercise the application as guest, staff, owner, another store, and payment provider. Check observable results and persisted outcomes rather than private helpers, component structure, or database implementation details.
2. **Playwright browser journeys:** use separate browser contexts for owner, staff, and guest, exercising the real web application and a dedicated test backend. Verify that actions in one context update the others through Convex subscriptions.

Replace only external payment and email delivery at their integration boundaries for deterministic development tests. Inject a controllable server clock for time-boundary tests, scoped to tests; production must not expose clock or simulated payment controls. Run provider contract/sandbox verification against the actual adapter once available, followed by user-authorized live verification before paid launch.

There are no existing product tests or test harnesses in this starter. The first slice establishes the smallest behavior-focused harness and one end-to-end owner journey; subsequent slices extend it. Use targeted tests for permissions, money, concurrency, and time rules; avoid tests that simply mirror internal implementation.

Required coverage:

- Owner registration, password recovery, store singleton/trial, invite acceptance/expiry/reuse, staff removal, and cross-store isolation.
- Menu updates, Unicode content, language switching without menu translation, public QR access, unavailable items, stale cart prices, valid tables, and immutable historical receipts.
- QR cash submit/table/track/cook/serve/collect, including same-table separate bills and uncertain-response retries.
- Counter cash submit/pay/assign table or Takeaway/cook/serve; recovery of paid unassigned orders after reload, disconnect, and subscription expiry.
- Direct attempts to bypass unpaid MMQR/counter cooking gates, edit submitted items, access another guest's order, or invoke owner-only actions as staff.
- Concurrent fulfillment/table changes, duplicate cash collection, owner cancellation reasons, full refund recording, served/refunded independence, unpaid cancellation exclusions, excess-collection refunds without cancelling a still-funded order, and uncertain refund chronology when verification followed external refund completion.
- Simulated MMQR success, failure, expiry, uncertainty, forged/wrong-merchant/wrong-amount/wrong-purpose events, duplicates, late success, and genuine overpayments across both order sources.
- Trial boundary, expired open tabs, existing-order completion after expiry, early renewal, lapse/reactivation, month-end/leap-year calendar calculations, duplicate/concurrent renewal confirmations, reversed distinct-invoice notifications across a lapse, and late success after a local attempt expired.
- Today/month reporting across Yangon midnight and month boundaries, including later-recorded money events and separation of store sales from platform subscription receipts.
- Multiple live browser contexts, sound opt-in, visual fallback, reconnect without duplicate orders or historical alert storms, and Burmese/English system text with unchanged menu content.
- Provider readiness: store versus platform merchant routing, real authenticated confirmation, real renewal access restoration, no production simulator path, and operational recovery for uncertain payments.

Each implementation slice must pass its relevant tests and workspace lint/type/build checks where applicable. Provider-dependent slices remain blocked by actual access and documentation; simulation is development evidence, not launch evidence.

## Out of Scope

- Multiple stores per owner, store switching, additional staff role types, and a customer account system.
- Per-table menu QR codes, reservations, combined table bills, split tender, partial payments/refunds, delivery, and customer QR takeaway ordering.
- Item variants/add-ons, inventory, discounts, tips, tax/service-charge controls, receipt-printer or cash-drawer integration.
- Editing submitted item lines, customer self-cancellation, automated refund execution, and automatic monthly debit.
- Automatic menu translation or required bilingual item fields.
- Offline order submission, native mobile apps, background push guarantees, and a new platform-admin dashboard. Platform support uses controlled internal procedures rather than an additional store role.

## Further Notes

- GitHub Issues for Adam26114/qr-pos-mm is the configured tracker. The user approved publication of this specification and all thirteen dependent implementation tickets with the configured triage vocabulary.
- The repository currently supplies a Next.js/shadcn monorepo starter; product flows and most backend/auth/testing integrations still need implementation.
- MMQR API access is not available yet. Provider documentation, store/platform merchant access, credentials, sandbox behavior, confirmation validation, and reconciliation contracts must be supplied or verified later. Live integration sizing is provisional until that material is known.
- Build and test provider-independent behavior first. The paid launch gate requires verified real customer MMQR and subscription renewal flows, in addition to passing application checks. No deployment, merchant onboarding submission, or real-money test payment is authorized by this draft.
