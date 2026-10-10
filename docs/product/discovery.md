# QR Menu and POS: Product Discovery

This is the completed interview record of confirmed product requirements. It describes the intended product, not implemented functionality. Domain terms are defined in [CONTEXT.md](../../CONTEXT.md).

## Confirmed scope

- Sell a subscription service to cafe and restaurant owners.
- Each owner has one store in the first release. Multiple stores per owner are a future feature and must not be implemented yet.
- Store users have two roles: owner and staff. Customers can order without creating accounts.
- Support both customer QR orders and counter orders entered through the POS.
- Support Burmese and English for system interface text in the customer menu and owner/staff screens.

## Accounts

- Owners register themselves using email and password.
- Owners invite staff, who receive their own accounts and sign in with email and password.
- Customer ordering and tracking do not require customer accounts.

## Interface language and menu content

- The language switch changes system interface text, including dashboard navigation, buttons, and status messages.
- Store-authored content, including menu item names, displays as the owner enters it, independent of interface language.
- Do not require separate Burmese and English menu content or automatically translate item names.

## Customer QR ordering

1. Scan the store's shared menu QR. There is one menu QR per store, not one per table.
2. Browse the menu and see item prices.
3. Select menu items and quantities, with customer notes as needed.
4. Review the cart and select the table where the customer is already seated.
5. Submit the order.
6. Track the order's live status.

Menu items start with one price per item, photos, categories, availability, and customer notes. Sizes, variants, and priced add-ons are outside this initial menu scope.

Displayed menu prices are final. Additional tax/service-charge controls and discount controls are outside the first release.

QR customers can pay by MMQR or cash. An MMQR order requires confirmed payment before cooking; a QR cash order can be prepared and paid after eating. Submitting an order and tracking it do not themselves establish payment.

Each submission is a separate order with its own bill. Multiple orders can share a table number; their bills are not combined.

Submitted order items remain fixed. A customer places a separate order for additional items.

## Counter POS ordering

1. The customer chooses items at the counter with staff.
2. Staff enters the counter order in the POS.
3. The customer pays at the counter.
4. After payment, staff assigns a table number or selects Takeaway.

Counter orders are paid upfront, including cash counter orders. The pay-after-eating cash option applies to seated QR ordering. Table assignment at the counter is performed by staff rather than the customer.

Owners/staff can correct an incorrect table selection for an order.

## Store operations

- New orders trigger an audio alert.
- The operational flow includes viewing pending orders, starting cooking, and marking orders served.
- Owners can create menu items, update prices, remove items, and view today's sales and monthly revenue.
- Staff can view the menu and orders, enter counter orders, start cooking, mark orders served, and record cash received.
- Only owners manage menus, prices, staff accounts, subscriptions, and revenue reports.
- Only owners cancel pending or cooking orders, with a reason. Served orders retain their served status even when refunded.
- Marking an order served and recording payment received are separate operations.

## Payments, cancellation, and refunds

- Customer payments go to the corresponding store's merchant account.
- Subscription payments go to the platform business's merchant account.
- The user does not currently have MMQR provider API access and will supply it later. The actual provider and integration contract remain external dependencies; do not invent provider API behavior.
- In the first release, owners handle refunds through their payment provider and record the outcome in the app.
- Support recording full-order refunds initially; partial refunds are outside this release.
- Cancellation does not mark a payment refunded. Order fulfillment, payment collection, and refund outcomes must remain distinguishable.

## Sales reporting

- Today's sales represent customer money actually collected during the day, not the value of orders submitted that day.
- Show unpaid orders separately.
- Today's sales and monthly reports show collected payments, completed refunds, and the net amount separately.

## Subscription

- One monthly plan at 30,000 MMK.
- A 14-day free trial, starting when the owner creates their store.
- Owners can pay the service subscription by MMQR.
- Owners manually pay by MMQR to renew each month; automatic monthly debit is outside the chosen renewal flow.
- Customer order payments to stores and owner subscription payments to the platform are distinct flows.
- After trial or subscription expiry, the store stops accepting new orders, including QR and counter orders. Existing orders can still be finished, and history and the renewal screen remain accessible.

## Required technology and state ownership

Retain the existing foundations and use the user's selected stack: Next.js 16 App Router, React 19, TypeScript, Convex backend and database, Better Auth with `@convex-dev/better-auth`, shadcn/ui, Tailwind CSS, React Hook Form, Zod, Redux Toolkit, Bun, Turborepo, and Playwright for browser verification.

Convex queries are the realtime client source of truth. Redux Toolkit is restricted to transient client state; do not copy Convex query results into Redux.

## Connectivity

The first release is online only. Internet access is required for ordering and POS operations. Show connection failures clearly and reconnect automatically; offline ordering is outside this release.

The user confirmed the interview summary and online-only scope. Technical behavior for order tracking, sound activation, payment retries, access checks, and historical data will be made explicit in the specification for review.

## Launch sequence

Build and test the other features while the user arranges MMQR provider access. Launch the paid service after real MMQR order payments and subscription renewals have been verified.

## Deferred provider verification

Once MMQR API access is available, verify merchant onboarding, payment creation, confirmation authenticity, order references, retries, expiry, and payment/refund reconciliation against that provider's documentation. Live order and subscription payments depend on this verification. Development of the other features can proceed while access is pending.
