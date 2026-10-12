# Local development and verification

Use Node.js 20.12+ and the pinned Bun 1.4.0. Run `bun install` at the repository root. The application uses Next.js App Router, Convex, Better Auth, shadcn/ui, React Hook Form and Zod. Convex subscriptions own persisted data; Redux contains only the transient interface language, whose preference is also saved in a cookie.

## Start the local backend

From `apps/web`, run:

```bash
CONVEX_AGENT_MODE=anonymous bunx convex dev --local-cloud-port 3210 --local-site-port 3211
```

Keep this process running. It provisions an anonymous local deployment, registers the Better Auth component, generates typed Convex references, and writes private `.env.local` deployment settings. Local deployment state under `.convex/` is ignored. For your own cloud development deployment, use `bun run convex:dev` and follow the Convex setup prompts instead.

Set the following **Convex backend** environment variables from `apps/web`:

```bash
bunx convex env set SITE_URL http://localhost:3000
bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 48)"
bunx convex env set DEV_EMAIL_CAPTURE_URL http://127.0.0.1:4010/emails
```

Check that `.env.local` contains `NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210` and `NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211`. The site URL is the HTTP actions endpoint, distinct from the client URL. The example environment file documents all required names; never commit real secrets.

From the repository root, run `bun run dev`. Open http://localhost:3000/register to create an account, then create its store. The trial starts at store creation and lasts exactly fourteen days. Sign-in and signup use email/password; customers use the public menu and ordering flow without accounts.

## Hosted development

The localhost app can use a hosted Convex development deployment. This machine keeps the selected cloud configuration in `apps/web/.env.local`, a saved cloud profile in `.env.cloud.local`, and the previous local test profile in `.env.local-backend`. These files are private and Git-ignored. `.env.cloud-backend` holds the private settings used to initialize cloud authentication; do not commit it or print its values.

Start the frontend with `bun run dev` at the repository root. In another terminal, run `bun run convex:dev` from `apps/web` to watch and deploy backend changes to the selected development deployment. The cloud backend has its own database and file storage; local accounts, menu photos and orders are not automatically transferred. Create an owner account in the cloud-backed app to begin using it.

Set `SITE_URL=http://localhost:3000` and a random `BETTER_AUTH_SECRET` on the hosted development backend. Real email delivery also requires `RESEND_API_KEY` and `AUTH_EMAIL_FROM` for a verified sender, set privately through Convex Deployment Settings or the CLI. Keep `DEV_EMAIL_CAPTURE_URL` unset on hosted deployments: the loopback capture server is available only to the local test backend. Until the email provider is configured, registration/password login can work, but invitations and password-reset emails cannot be delivered. See [Convex environment variables](https://docs.convex.dev/production/environment-variables).

For the full browser suite, stop the frontend and cloud watcher, then from `apps/web` copy `.env.local-backend` to `.env.local`. Start the local backend using the earlier instructions and run `bun run test:e2e`. The existing test guard deliberately refuses cloud URLs. After testing, stop the local processes, copy `.env.cloud.local` back to `.env.local`, and restart the frontend and cloud watcher. Changing profiles requires restarting processes; copying a file does not migrate any database data.

To verify focused journeys while a hosted frontend is already running, use a separate checkout with its own dependencies, local backend state, and local `.env.local`. Set that isolated backend's `SITE_URL=http://localhost:3001`. For orders, run `E2E_PORT=3001 bun run test:e2e e2e/pos.spec.ts e2e/qr-operations.spec.ts e2e/orders-board.spec.ts`; for customer menus, run `E2E_PORT=3001 bun run test:e2e e2e/customer-menu-sections.spec.ts e2e/public-menu.spec.ts e2e/guest-orders.spec.ts`. These journeys support the configured port, which defaults to 3000, and the local-backend URL guard still applies. Keep the running hosted checkout and its private profile intact.

## Tests

```bash
bun run typecheck
bun run lint
bun run test
cd apps/web
bunx playwright install chromium
bun run test:e2e
```

Backend tests use the real Better Auth component in `convex-test`; only the clock is controlled. Browser tests run against the local deployment above, create uniquely named test accounts/stores, and use a loopback mail-capture server instead of sending emails. They never remove deployment data. The configuration rejects cloud backend URLs. Playwright starts the mail server and frontend automatically, or reuses a frontend already running on port 3000; make sure that frontend is this repository with the same local deployment settings.

To inspect password recovery or staff invitation email manually, run `node scripts/mail-capture.mjs` from `apps/web`, exercise the retained email invitation API or request a reset, and inspect http://127.0.0.1:4010/messages. The test receiver exposes private invitation and recovery links, so it binds only to loopback and belongs only in local development. Playwright traces and screenshots are ignored.

## Production configuration

Set `SITE_URL` to the actual HTTPS frontend URL and configure a random `BETTER_AUTH_SECRET` on the Convex backend. Configure `RESEND_API_KEY` and `AUTH_EMAIL_FROM` for a verified sender, and remove `DEV_EMAIL_CAPTURE_URL`. Set both public Convex URLs on the Next.js deployment. The capture transport rejects non-local deployment URLs. Verify actual password recovery before deploying to users. The new owner share-link flow needs no email delivery; retained legacy email invitation APIs still use the configured sender. Invitation delivery is shown as queued, sent (accepted by the email transport), or failed; a failed invitation can be canceled and recreated after fixing the sender setup.

Store creation is an atomic, idempotent Convex mutation: one owner membership, one store, and one trial. Private owner store reads authorize current owner membership. Operational commands must use `requireStoreMembership`, and owner-only commands must use `requireStoreOwner`; neither should trust a role cached in a browser or JWT. `convex/lib/store_access.ts` provides the shared server-time entitlement and new-order guard; later order commands must invoke that guard. Scheduled expiry updates invalidate subscribed workspace queries; delayed scheduling cannot extend backend access. Historical workspace reads remain available after expiry.

Implemented: issues #2 through #11, plus the approved staff access and menu/Orders redesigns. Owners manage staff at `/workspace/staff` through shadcn data tables. Create a single-use join link with a 1, 3 or 7-day expiry (default 7), copy it while the creation result is open, and share it with the intended staff member. No email delivery is required for this flow. The backend stores only a token hash; regenerating returns a new URL and invalidates the previous one. Owners can revoke pending links. Existing email invitations remain email-bound and usable until acceptance, revocation or expiry.

Staff register with their own name, email and password, or sign in to an existing individual account, then optionally enter a contact phone and join. Acceptance creates only a staff membership, never a store or trial. Phone is membership contact information, never an authentication identifier. At most one active store membership is allowed per account.

Owners deactivate or reactivate staff after confirmation. Deactivation invalidates realtime workspace access without deleting the account or order history. Historical memberships prevent owner onboarding and repeated trials. Deactivated staff cannot bypass the decision through another join link or legacy invitation; only owner reactivation restores this store's access, subject to the active-membership conflict guard. Staff workspace responses include operational store identity only, excluding owner entitlement and billing data.

For focused staff verification, use the isolated local checkout procedure above and run `E2E_PORT=3001 bun run test:e2e e2e/staff.spec.ts e2e/pos.spec.ts e2e/qr-operations.spec.ts`. These journeys cover separate owner/staff sessions, contact entry, single-use links, live deactivation/reactivation, revocation/replacement, existing-account acceptance/password recovery, languages, themes and narrow layouts.

Owners manage categories and items in dialogs at `/workspace/menu`. Owners and staff can browse the catalog and enter cash counter orders; only owners see menu, category and table controls. Names and descriptions stay exactly as authored, independent of the system language. Item prices are positive safe integers in whole MMK. Items and categories are archived rather than deleted. Categories with active items must first have those items moved or removed from sale. The current preview omits removed offerings and marks unavailable items. Submitted counter bills retain immutable item names, unit prices, quantities and notes.

Menu photos use the authenticated Convex `/menu-photo` HTTP action. It checks current owner membership before reading the upload, limits the streamed body to 5 MB, allows JPEG/PNG/WebP with matching raster signatures, and registers the stored file to the authorized store with a second atomic membership check. Item writes accept only registered photos from the same store with an existing storage object; clients cannot claim arbitrary storage IDs. Menu queries resolve photo URLs only for same-store records. These raster photo URLs are intentionally suitable for the later public menu; they are not private account documents. Existing photo records are retained when replaced or removed, preserving references for historical use. See [Convex HTTP uploads](https://docs.convex.dev/file-storage/upload-files) for the storage transport.

Browser verification covers category/item edits and removal, photo upload/removal, invalid uploads, positive whole-MMK validation, persistence, Burmese mobile layout, offline guards and live menu convergence between separate browser contexts. Public-boundary tests cover role/store isolation, invalid amounts, archiving and foreign-photo rejection.

Cash POS now runs at `/workspace/menu`: search or filter the photo catalog, add quantities and a note, then save a separate bill. Explicitly confirm full cash received before choosing a table or Takeaway. `/workspace/orders` provides the live queue, cooking/serving actions, destination corrections with an audit trail, and paginated served history. Owners maintain numbered tables; removed tables remain referenced by historical orders. Order sound requires opt-in and is disabled on lost connection. Re-enabling obtains a fresh server baseline so accumulated work is not replayed.

Only new orders require active service; accepted bills remain recoverable and completable after expiry. Each submission uses a creator/store-scoped key. Matching retries recover the original order before checking current entitlement or menu; a changed payload cannot reuse its key. The cart holds IDs, quantities and a note in local state. Browser storage holds only the frozen submission command and recovery token, never copied menu/queue data. Uncertain results stay locked until Convex confirms acceptance or the same command is retried. Server rejections allow a reviewed replacement submission. New commands require a live connection.

Public QR browsing completes #5; guest cash orders and private tracking complete #6. Seated cash preparation and post-meal collection complete #7; prepaid cash counter ordering completes #8. Owner cancellation and full external refund recording complete #9; owner revenue reports complete #10. MMQR payments and subscription renewals remain the subsequent approved tickets. Live MMQR integration awaits provider API access and verified payment flows before the paid service launch.

## Cancellation and refund records

Owners cancel pending/cooking orders through the Orders ticket menu, with a required internal reason. Cancellation leaves the bill and collection history intact, removes it from live lanes, and blocks new collection, destination and fulfillment commands. Staff and guests cannot perform cancellation/refund mutations. Existing accepted orders remain manageable after service expiry.

History includes served and cancelled orders with All/Served/Cancelled filtering and indexed pagination. Owners record completed full external refunds against an individual confirmed collection; the amount, currency, method and payment reference come from the backend record. Cash must already have been physically returned. No provider refund transfer or manually asserted MMQR confirmation is implemented. A pending/cooking order must be cancelled before returning its required funding; a genuine excess collection can be returned while full required funding remains. Served stays served after refunds. Guest capabilities expose outcomes without internal reasons, references or audit actors.

New cash receipts use `orderCollections`; `cashPayments` is retained as a read-only legacy source. Compatibility readers count a legacy receipt once before or after migration. After deploying, run the internal upgrade from `apps/web` with `bunx convex run orders:migrateRecords '{"phase":"cash"}'`. It migrates receipts in restartable batches, preserves original collection time and actor, then backfills indexed terminal-history membership for existing orders. Re-running creates no duplicate money movements. All History uses an indexed legacy probe and a creation-ordered compatibility reader until served-history backfill completes; no existing history disappears during the upgrade. Opaque pagination cursors retain their reader mode so Load more also continues correctly when backfill finishes between pages. Verify completion of the scheduled batches before considering the upgrade complete. Do not delete legacy receipts.

Refund completion defaults to server time; earlier values use Asia/Yangon in the dialog and UTC milliseconds at the API. Known collection timestamps bound the earliest valid refund. A verification fallback can legitimately follow a refund and is flagged as uncertain chronology. Each refund retains the collection timestamp and provenance, completion time, recording time and actor. Exact matching retries recover the original record; changed payloads or a second refund for one collection are rejected.

Run focused browser verification in the isolated checkout with `E2E_PORT=3001 bun run test:e2e e2e/refunds.spec.ts e2e/orders-board.spec.ts e2e/pos.spec.ts e2e/qr-operations.spec.ts`. Backend coverage in `convex/refunds.test.ts` uses public authenticated operations, with legacy/provider collections as fixtures rather than an exposed simulator API.

Owners open **Menu QR** at `/workspace/menu` to preview and download the store’s one printable SVG QR. It encodes only the stable `/menu/<storeId>` URL on the current frontend origin, with no table, order or payment identity. Changing menu content or tables does not change this link. The SVG preserves a four-module white quiet zone and black modules for printing. A localhost QR opens only on that computer; use a network-reachable frontend address for phone testing, and the eventual public frontend domain for customer prints.

Guests can browse this phone-friendly menu without authentication, search and filter categories, and see photos, final prices and availability live. System language switches between Burmese and English without changing authored content. Disconnection is shown explicitly; menu data is never persisted as an offline catalog or copied into Redux. The public Convex projection includes only store identity/name, active categories/items, same-store photo URLs, and active table identifiers/numbers. Invalid links show a localized recovery message. Backend tests verify public field limits, store separation, archiving and photos; browser verification independently decodes the downloaded SVG and covers logged-out mobile browsing, live changes, languages and reconnect. Guests can add quantities and one order-level note, review prices, select their seated table, and submit a separate cash bill. A live price or availability change blocks submission until the cart is reviewed again. Convex revalidates current offerings and tables and calculates the total at acceptance. Accepted names, quantities, unit prices, notes and table numbers remain fixed despite later menu/table removal.

Each guest submission generates a 256-bit random private capability. Its SHA-256 hash is stored with the receipt; operational order documents never contain the raw capability. Only `/orders/<capability>` can reveal that guest receipt, with a copyable link and separate preparation/payment statuses. Tracking pages exclude search indexing and suppress referrers. Table and displayed bill identifiers grant no guest access. Anyone explicitly given the private link can view its order.

Browser storage retains private receipt capabilities and any exact unresolved submission command in independent records, so separate browser tabs cannot overwrite one another’s recovery data. It does not store copies of menu or order query results. The command is saved before sending, reused after uncertain responses and reloads, and locked against edits until acceptance or a definitive server rejection. Accepted retries recover before menu/table/entitlement checks; new orders require active service. Guests can return to the menu for another separate bill while keeping their previous tracking links. The Orders page shows pending/cooking QR bills and served unpaid bills to current owners/staff. Seated cash QR orders can be prepared and served before collection; counter bills still require cash and a destination before cooking. Staff can correct QR tables before collection and after service, with actor, timestamp and previous/new destinations audited. QR orders keep a seated table; Takeaway remains a counter destination. Table corrections preserve item snapshots, totals, payment and preparation timestamps. Cash collection records one payment and one money event atomically, including concurrent retries and races with serving. Accepted orders remain operable after trial expiry; new submissions remain gated. Served unpaid queue membership uses an index maintained atomically with service and payment, so the live queue does not scan paid history.

Focused backend tests exercise guest price authority, store/table isolation, immutable receipts, private projections, concurrent retries, expiry and live status reads. Browser checks cover mobile Burmese/English ordering, separate same-table bills, private links and clipboard copying, price review invalidation, offline guards, and real Convex traffic with a dropped outbound submission and lost acknowledgement, followed by recovery without duplicate bills.

Order alerts mark newly actionable pending work visually, independently of sound opt-in. Counter bills become actionable after cash and assignment; seated cash QR bills are actionable immediately. A fresh authenticated server baseline is established on entry/reconnect. Notification state contains identities only, and missed history is not replayed. Sound requires an explicit user gesture and another opt-in after lost connection; enabling it establishes a fresh baseline again. Mark all seen clears the transient badges. Tracker identities remain remembered until the view disconnects or unmounts, preventing repeat alerts as orders leave the pending queue. Realtime bill data continues to come directly from Convex.

Ticket #7 verification covers unpaid preparation/service, duplicate and concurrent collection, service/payment races, audit idempotence, store/role isolation, staff removal, and expiry at public Convex boundaries. A real owner/staff/guest Playwright journey covers mobile Burmese layout, live private tracking, table correction, post-meal collection, confirmation guards, and the actual Web Audio output boundary for opt-in, reconnect and muted visual alerts. No payment provider simulator or MMQR integration is enabled by this slice.

Ticket #8 verification covers an actual dropped outbound counter submission and a lost acknowledgement of its real retry. Reloading reconciles the frozen command against Convex and recovers one immutable bill. A second session observes the unpaid bill and disabled cooking/assignment, then the confirmed payment; another reload recovers the paid-but-unassigned bill before table assignment. Staff Takeaway handover is covered separately. Public-operation tests verify paid/unassigned and unpaid recovery after expiry, denied new submissions, and concurrent assignment/correction audit continuity. Identical simultaneous destination commands produce one change; distinct corrections are serialized, with the latest committed destination reflected live and every prior destination retained in history.

## Owner revenue reports

Owner Overview supports current and past Yangon days/months, with collected payments, completed refunds, net collected and a separate current unpaid amount/count. Collections use `collectedAt` and its retained timestamp provenance; refunds use `completedAt`. A later-recorded event updates its applicable historical day. Net may be negative. Unpaid now spans all dates, excludes cancelled/refunded bills and remains accessible after subscription expiry. Staff receive no reporting queries or dashboard metrics.

Daily totals and current unpaid contributions are maintained atomically alongside order creation, cash collection, cancellation and refund writes. Future confirmed provider collection writers must use the same reporting helpers in their authoritative transaction; adding a ledger record alone is not a complete write path. Contribution markers prevent duplicate backfill/retry counting. Financial detail queries use store/event-time indexes; unpaid details use indexed outstanding membership. Monthly summaries read at most a month's daily buckets. Subscription receipts are outside these sources.

After deploying the backend, from `apps/web` run `bunx convex run reports:backfillAll '{}'`. This schedules bounded, restartable per-store batches for legacy receipts, collections, refunds and order unpaid contributions. Existing reporting contributions are preserved; retries do not add them again. Live operations continue during backfill. Reports show preparation feedback until their store is ready. Verify scheduled batches and reporting readiness before completing delivery; keep legacy receipts. The previous #9 receipt migration remains safe to rerun.

The current-date query uses unique refresh arguments to avoid a stale cached server clock. The client schedules the next Yangon midnight from server time, refreshes on foreground/reconnect, and keeps explicit past periods fixed. Persisted report results are not copied into Redux or browser storage.

Run `bun run test convex/reports.test.ts` for report public-operation coverage. In the dedicated local checkout, run `E2E_PORT=3001 bun run test:e2e e2e/reports.spec.ts e2e/owner.spec.ts e2e/workspace.spec.ts e2e/orders-board.spec.ts e2e/refunds.spec.ts`. Report browser coverage includes owner/staff isolation, live financial changes, historical selection, unpaid row removal/focus, pagination, server-clock refresh, themes, languages and narrow layouts.

## Local MMQR simulator (ticket #11)

Use a separate isolated checkout and the dedicated 3210/3211 backend. Preserve the hosted `.env.local` profile. Explicitly enable the **backend** `ORDER_PAYMENT_SIMULATOR=enabled`, set a private random `SIMULATOR_EVENT_SECRET` of at least 32 characters, and set backend `SITE_URL` to the loopback frontend (3001 for verification). `CONVEX_CLOUD_URL` and `CONVEX_SITE_URL` are runtime deployment URLs. All three URLs must use HTTP and localhost/127.0.0.1/::1. A cloud deployment rejects simulation even if its opt-in flag is accidentally enabled. Keep `ORDER_PAYMENT_SIMULATOR` disabled and its signing secret unset on hosted/production deployments. No NEXT_PUBLIC switch or developer browser page controls payment outcomes.

Cash remains the default. Local guest review and counter checkout offer **MMQR — simulation**. Submission fixes the method and saves the bill first. The shared panel automatically creates or recovers the existing non-payable test QR, shows its 15-minute server deadline, and provides Check payment and retry for failed/expired attempts. Uncertainty and local expiry alone do not prove that no money was received. Reconciliation precedes a replacement. Exact start retries recover their original attempt, including keys that originally reused another unresolved attempt. Interrupted checkout creation offers Recover checkout, reusing the same durable attempt without replacing uncertain payment. Guest capabilities authorize guest operations; current membership authorizes operational checks. Clients cannot submit outcomes, amounts or merchant routing.

Developer commands run only from the isolated checkout's `apps/web`:

```bash
bunx convex run simulator:creation '{"available":false}'
# Restore availability before recovery:
bunx convex run simulator:creation '{"available":true}'
bunx convex run simulator:attempts '{"orderId":"<order id>"}'
bunx convex run simulator:outcome '{"attemptId":"<attempt id>","outcome":"succeeded","transactionId":"test-payment-1"}'
bunx convex run simulator:outcome '{"attemptId":"<attempt id>","outcome":"failed"}'
bunx convex run simulator:outcome '{"attemptId":"<attempt id>","outcome":"expired"}'
bunx convex run simulator:outcome '{"attemptId":"<attempt id>","outcome":"uncertain","notify":false}'
```

`outcome` changes the protected simulated provider, then delivers signed events through `/order-payment-events`. `notify:false` retains the provider result without notification to exercise Check payment reconciliation. Restore provider availability with pending/failed/expired/succeeded. Reuse a transaction identity to repeat a notification; choose a new identity to exercise a genuine additional collection. An optional `completedAt` is UTC milliseconds; `omitCompletionTime:true` exercises verification-time fallback. Never share the signing secret or guest capability in logs or issue comments.

The ingestion transaction validates merchant, purpose, reference, MMK currency, exact bill amount, completion time and provider transaction identity. Confirmation records collections, reporting/unpaid contributions and audit evidence atomically. Late payments on cancelled bills remain collected, and extra money appears in owner Review payments. No outcome reopens a cancelled order or automatically returns money. Refund records inherit the simulated label. Confirmed MMQR funding gates QR cooking and counter assignment/cooking; cash collection on an MMQR bill is rejected. Existing seated Cash orders retain pre-payment preparation and post-meal collection.

After deployment with simulation disabled, rerun `bunx convex run reports:backfillAll '{}'`. Its bounded restartable order phase also initializes indexed payment-review membership/counts and readiness. Existing contribution markers prevent double counting during live operations and repeated backfills. Confirm every `reportStates` row is report-ready and payment-review-ready; verify `payments:capabilities` is false on hosted development. Review controls show preparation feedback during backfill, never partial counts.

Run `bun run test convex/payments.test.ts` and in the isolated checkout `E2E_PORT=3001 bun run test:e2e e2e/payments.spec.ts e2e/pos.spec.ts e2e/guest-orders.spec.ts e2e/qr-operations.spec.ts`. The payment journey uses protected CLI outcomes, actual signed HTTP delivery, separate staff/owner/guest sessions, a lost action acknowledgement, reload recovery, reconciliation, funding gates, owner refund resolution and simulated reporting. Run the full backend suite only after browser verification finishes, then the production build. Simulation does not validate real merchant routing or paid launch readiness; those remain #13 and later work.
