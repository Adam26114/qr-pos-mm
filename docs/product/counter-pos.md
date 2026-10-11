# Workspace cash POS

Approved scope: photo-card Menu catalog with search and category filters, owner-only menu/category dialogs and numbered table management, a working cash cart for owners and staff, and a separate live Orders page. Inspired by https://shadcnuikit.com/dashboard/apps/pos-system; retain repository shadcn compositions and authored content.

Each submission creates a separate immutable bill. Save at the counter, record full cash received, assign an active table or Takeaway, then Start Cooking and Mark Served. Payment and fulfillment remain separate. Owners and staff can correct destinations; the actor, time and previous/new destination are retained. Removing a table does not rewrite old orders. Owners alone manage tables and menus.

Only new submissions require active service. Accepted orders can be recovered, paid, assigned and completed after expiry. A creator-scoped submission key identifies one payload: retries recover the accepted order before rechecking current prices, availability or entitlement, while changed payloads cannot reuse a key. Current prices and availability are checked at initial acceptance; all totals are computed on the server in safe whole MMK. No extra charges or discounts.

Convex subscriptions are authoritative. The cart holds only item IDs, quantities and a note. A persisted submission attempt is a receipt-recovery token and frozen command, never an offline order queue. Mutations require a live connection; uncertain outcomes reconcile against Convex before another submission. Unpaid and paid/unassigned orders remain visible after reload. System text is Burmese/English; authored content is unchanged.

Cash counter ordering completes #8, including lost-response recovery, paid/unassigned reload recovery, pre-expiry order completion and concurrent assignment verification. Public QR ordering/tracking and seated cash operations are implemented in #5–#7. MMQR, cancellation/refunds and revenue reports remain future slices.

Verification seams remain the approved public Convex operations and real Playwright owner/staff journeys. Cover payment/state ordering, immutable bills, retries, expiry, store/role isolation, table retention, realtime updates and reload recovery.
