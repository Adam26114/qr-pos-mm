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

From the repository root, run `bun run dev`. Open http://localhost:3000/register to create an account, then create its store. The trial starts at store creation and lasts exactly fourteen days. Sign-in and signup use email/password; customers will not need accounts in later slices.

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

Implemented locally: issues #2 and #3. Owners can invite staff from `/workspace`. An invitation binds one store and a normalized email, lasts seven days, and can be accepted once by a signed-in account with that email. The invitation page supports individual account signup or existing-account sign-in. Acceptance creates only a staff membership; it never creates a store or trial. Pending invitation retries reuse the existing invitation, while canceled or expired invitations can be replaced. Owners can cancel pending invitations and remove active staff after confirmation.

Membership removal invalidates realtime workspace access without deleting the account. Membership history is retained, so removed staff can sign in/recover their password but cannot enter owner onboarding or restart a trial. A fresh invitation may restore staff access; at most one active store membership is allowed. Staff workspace responses include operational store identity only, excluding owner entitlement and billing data. Browser tests cover separate owner/staff contexts, live removal and cancellation, existing-account acceptance, staff password recovery, Burmese mobile screens, and offline/backend disconnection guards.

Menus, QR ordering, POS, payments and renewals remain the subsequent approved tickets. Live MMQR integration awaits provider API access and verified payment flows before the paid service launch.
