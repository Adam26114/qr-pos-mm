# QR Menu and POS Service

A subscription service for cafe and restaurant owners, connecting their menus, customer orders, and shop operations.

## Language

**Store**:
A cafe or restaurant operated by an owner and served by this platform.
_Avoid_: Shop as a separate concept from store.

**Menu QR**:
The shared QR code for a store that opens its menu. Customers select their table separately when placing an order.
_Avoid_: Table QR, payment QR.

**Table**:
A numbered seating location within a store, selected by a seated customer for a QR order or assigned by staff for a counter order.

**Owner**:
The person who subscribes to the service for a store and controls its menu, prices, staff access, and sales reporting.
_Avoid_: User when the owner role is intended.

**Staff**:
A store worker who can view the menu and orders, enter counter orders, advance preparation and service, and record cash received.
_Avoid_: Owner, admin.

**Staff Join Link**:
A private, store-bound invitation that admits one staff account before its owner-selected expiry. Owners share the link directly and can revoke or replace it. A contact phone is optional membership information, never a login credential.

**Staff Deactivation**:
An owner's decision to immediately block a staff membership's access to the store while preserving the account and history. Only the owner can reactivate that membership; another invitation cannot bypass deactivation.
_Avoid_: Account deletion, global platform ban.

**Customer**:
A guest who orders from a store without creating an account, either through its menu QR or with staff at the counter.
_Avoid_: User when the customer is intended.

**Menu Item**:
A food or drink offering on a store's menu, with a displayed price and a name shown exactly as entered by the owner, independent of the interface language.

**Signature Item**:
A menu item the owner selects to highlight as a store specialty. A store may have several signature items; selection is independent of sales popularity and does not change the item's price or order behavior.
_Avoid_: Popular item as a synonym for owner selection.

**Cart**:
A customer's selection of menu items and quantities before submitting an order.

**Order**:
A submitted request for menu items from one store, with its own bill and preparation and service progress. Orders remain separate even when they share a table number.
_Avoid_: Cart, payment.

**QR Order**:
An order a customer places through the menu opened by a store's menu QR.

**Counter Order**:
An order entered on the customer's behalf through the store's POS, paid at the counter before staff assigns a table or marks it for takeaway.

**Takeaway**:
A counter order to be taken away rather than served at a table.

**POS**:
The store's point-of-sale workspace for entering counter orders and managing sales alongside QR orders.

**Order Status**:
The progress of an order through the store's preparation and service process: pending, cooking, served, or cancelled.
_Avoid_: Payment status.

**Order Payment**:
Money a customer pays a store for an order, using cash or MMQR.
_Avoid_: Subscription payment.

**Payment Status**:
The collection or refund state of an order's payment, separate from whether the order is cooking or served.
_Avoid_: Order status.

**Cancellation**:
An owner's recorded decision, with a reason, to stop fulfilling a pending or cooking order. It does not establish a refund or change a served order back to an unserved state.
_Avoid_: Refund.

**Refund**:
The return of a full order payment, handled externally and recorded by the owner in the platform. It does not erase a served order's fulfillment history.
_Avoid_: Cancellation.

**Collection**:
A confirmed money movement for an order, retaining method, payment reference, amount, and collection-time provenance. Two genuine payments are two collections; repeated notification of one payment is not another collection.

**Full Refund Record**:
An owner's immutable attestation that one entire collection was returned externally, with its reason, completion time, and separate recording actor/time. It does not execute a transfer. Refunding an excess collection preserves fulfillment when the required bill remains funded.

**Uncertain Refund Chronology**:
A refund completion that preceded a collection's late verification timestamp when its actual completion time was unavailable. Retain the evidence for review rather than treating verification time as proof that collection occurred later.

**Collected Sales**:
Customer order payments received by a store during a reporting period. Unpaid orders are shown separately.
_Avoid_: Orders placed, subscription revenue.

**Subscription**:
The owner's monthly paid access to the platform's service for their store.
_Avoid_: Customer order.

**Trial**:
The owner's initial 14-day period of free access to the service, beginning when their store is created.

**Subscription Payment**:
Money an owner pays the platform for the service subscription, with MMQR as a supported payment method.
_Avoid_: Order payment, store sales.
