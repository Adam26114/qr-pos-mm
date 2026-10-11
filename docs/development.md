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

To inspect password recovery or staff invitation email manually, run `node scripts/mail-capture.mjs` from `apps/web`, invite staff from the owner workspace or request a reset, and inspect http://127.0.0.1:4010/messages. The test receiver exposes private invitation and recovery links, so it binds only to loopback and belongs only in local development. Playwright traces and screenshots are ignored.

## Production configuration

Set `SITE_URL` to the actual HTTPS frontend URL and configure a random `BETTER_AUTH_SECRET` on the Convex backend. Configure `RESEND_API_KEY` and `AUTH_EMAIL_FROM` for a verified sender, and remove `DEV_EMAIL_CAPTURE_URL`. Set both public Convex URLs on the Next.js deployment. The capture transport rejects non-local deployment URLs. Verify actual password recovery and staff invitation delivery before deploying to users. Invitation delivery is shown as queued, sent (accepted by the email transport), or failed; a failed invitation can be canceled and recreated after fixing the sender setup.

Store creation is an atomic, idempotent Convex mutation: one owner membership, one store, and one trial. Private owner store reads authorize current owner membership. Operational commands must use `requireStoreMembership`, and owner-only commands must use `requireStoreOwner`; neither should trust a role cached in a browser or JWT. `convex/lib/store_access.ts` provides the shared server-time entitlement and new-order guard; later order commands must invoke that guard. Scheduled expiry updates invalidate subscribed workspace queries; delayed scheduling cannot extend backend access. Historical workspace reads remain available after expiry.

Implemented locally: issues #2, #3, #4 and #5. Owners can invite staff from `/workspace/staff`. An invitation binds one store and a normalized email, lasts seven days, and can be accepted once by a signed-in account with that email. The invitation page supports individual account signup or existing-account sign-in. Acceptance creates only a staff membership; it never creates a store or trial. Pending invitation retries reuse the existing invitation, while canceled or expired invitations can be replaced. Owners can cancel pending invitations and remove active staff after confirmation.

Membership removal invalidates realtime workspace access without deleting the account. Membership history is retained, so removed staff can sign in/recover their password but cannot enter owner onboarding or restart a trial. A fresh invitation may restore staff access; at most one active store membership is allowed. Staff workspace responses include operational store identity only, excluding owner entitlement and billing data. Browser tests cover separate owner/staff contexts, live removal and cancellation, existing-account acceptance, staff password recovery, Burmese mobile screens, and offline/backend disconnection guards.

Owners manage categories and items in dialogs at `/workspace/menu`. Owners and staff can browse the catalog and enter cash counter orders; only owners see menu, category and table controls. Names and descriptions stay exactly as authored, independent of the system language. Item prices are positive safe integers in whole MMK. Items and categories are archived rather than deleted. Categories with active items must first have those items moved or removed from sale. The current preview omits removed offerings and marks unavailable items. Submitted counter bills retain immutable item names, unit prices, quantities and notes.

Menu photos use the authenticated Convex `/menu-photo` HTTP action. It checks current owner membership before reading the upload, limits the streamed body to 5 MB, allows JPEG/PNG/WebP with matching raster signatures, and registers the stored file to the authorized store with a second atomic membership check. Item writes accept only registered photos from the same store with an existing storage object; clients cannot claim arbitrary storage IDs. Menu queries resolve photo URLs only for same-store records. These raster photo URLs are intentionally suitable for the later public menu; they are not private account documents. Existing photo records are retained when replaced or removed, preserving references for historical use. See [Convex HTTP uploads](https://docs.convex.dev/file-storage/upload-files) for the storage transport.

Browser verification covers category/item edits and removal, photo upload/removal, invalid uploads, positive whole-MMK validation, persistence, Burmese mobile layout, offline guards and live menu convergence between separate browser contexts. Public-boundary tests cover role/store isolation, invalid amounts, archiving and foreign-photo rejection.

Cash POS now runs at `/workspace/menu`: search or filter the photo catalog, add quantities and a note, then save a separate bill. Explicitly confirm full cash received before choosing a table or Takeaway. `/workspace/orders` provides the live queue, cooking/serving actions, destination corrections with an audit trail, and paginated served history. Owners maintain numbered tables; removed tables remain referenced by historical orders. Order sound requires opt-in and is disabled on lost connection. Re-enabling obtains a fresh server baseline so accumulated work is not replayed.

Only new orders require active service; accepted bills remain recoverable and completable after expiry. Each submission uses a creator/store-scoped key. Matching retries recover the original order before checking current entitlement or menu; a changed payload cannot reuse its key. The cart holds IDs, quantities and a note in local state. Browser storage holds only the frozen submission command and recovery token, never copied menu/queue data. Uncertain results stay locked until Convex confirms acceptance or the same command is retried. Server rejections allow a reviewed replacement submission. New commands require a live connection.

The counter slice implements parts of #5–#7 and the cash path of #8. Public QR browsing completes #5; guest cash orders and private tracking complete #6. QR preparation and post-meal cash collection controls follow in #7. Cancellation/refunds, reports, MMQR payments and subscription renewals remain the subsequent approved tickets. Live MMQR integration awaits provider API access and verified payment flows before the paid service launch.

Owners open **Menu QR** at `/workspace/menu` to preview and download the store’s one printable SVG QR. It encodes only the stable `/menu/<storeId>` URL on the current frontend origin, with no table, order or payment identity. Changing menu content or tables does not change this link. The SVG preserves a four-module white quiet zone and black modules for printing. A localhost QR opens only on that computer; use a network-reachable frontend address for phone testing, and the eventual public frontend domain for customer prints.

Guests can browse this phone-friendly menu without authentication, search and filter categories, and see photos, final prices and availability live. System language switches between Burmese and English without changing authored content. Disconnection is shown explicitly; menu data is never persisted as an offline catalog or copied into Redux. The public Convex projection includes only store identity/name, active categories/items, same-store photo URLs, and active table identifiers/numbers. Invalid links show a localized recovery message. Backend tests verify public field limits, store separation, archiving and photos; browser verification independently decodes the downloaded SVG and covers logged-out mobile browsing, live changes, languages and reconnect. Guests can add quantities and one order-level note, review prices, select their seated table, and submit a separate cash bill. A live price or availability change blocks submission until the cart is reviewed again. Convex revalidates current offerings and tables and calculates the total at acceptance. Accepted names, quantities, unit prices, notes and table numbers remain fixed despite later menu/table removal.

Each guest submission generates a 256-bit random private capability. Its SHA-256 hash is stored with the receipt; operational order documents never contain the raw capability. Only `/orders/<capability>` can reveal that guest receipt, with a copyable link and separate preparation/payment statuses. Tracking pages exclude search indexing and suppress referrers. Table and displayed bill identifiers grant no guest access. Anyone explicitly given the private link can view its order.

Browser storage retains private receipt capabilities and any exact unresolved submission command in independent records, so separate browser tabs cannot overwrite one another’s recovery data. It does not store copies of menu or order query results. The command is saved before sending, reused after uncertain responses and reloads, and locked against edits until acceptance or a definitive server rejection. Accepted retries recover before menu/table/entitlement checks; new orders require active service. Guests can return to the menu for another separate bill while keeping their previous tracking links. The owner Orders page immediately shows pending QR bills; QR cooking, cash collection and table correction are the next slice (#7). Counter controls continue to work as before.

Focused backend tests exercise guest price authority, store/table isolation, immutable receipts, private projections, concurrent retries, expiry and live status reads. Browser checks cover mobile Burmese/English ordering, separate same-table bills, private links and clipboard copying, price review invalidation, offline guards, and real Convex traffic with a dropped outbound submission and lost acknowledgement, followed by recovery without duplicate bills.
