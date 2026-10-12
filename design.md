# QR POS design guide

Use this guide when creating or changing screens, layouts, styling, or UI interactions. It records the owner's accepted design choices. When the owner changes a choice, update this guide with the implementation.

Use [CONTEXT.md](CONTEXT.md) and the approved GitHub issue for domain behavior. Use [UI composition](docs/agents/ui-components.md) for component APIs and code placement. This guide owns visual direction; those documents own implementation contracts and business rules.

## Visual language

- Build on the existing shadcn/ui Base UI primitives and reusable compositions. Preserve the repository's `base-vega` configuration and Hugeicons icon family.
- Use the existing neutral surfaces, green primary accent, rounded corners, subtle borders, and restrained shadows. Primary buttons identify the main action; outline or ghost buttons serve secondary actions; destructive styling identifies removal.
- Support light and dark themes, following the system preference by default. Keep photo-overlay controls opaque and readable over both bright and dark images.
- Use the configured heading, body, and monospace fonts through the existing font utilities. Preserve readable Burmese fallback text and adequate line height.
- Use semantic Tailwind tokens such as `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, and `bg-primary`. Exact colors and radius values belong in [globals.css](packages/ui/src/styles/globals.css); font configuration belongs in [the root layout](apps/web/app/layout.tsx).
- Keep operational screens compact. Use spacing to group related controls and reserve cards for meaningful content groups.

## Workspace shell

Use the collapsible shadcn sidebar and separate workspace pages. Preserve the current role-dependent navigation.

Keep the dashboard header compact: sidebar toggle and page identity on the left, connection status, language, and account controls on the right. Online status belongs in this header. On phones, use the compact status dot with an accessible translated label so language and account controls still fit. Offline and backend-disconnection explanations remain visible near the affected content.

## Menu and POS layout

The Menu page combines the catalog and current counter-order cart:

```text
Dashboard header: page identity        Online · Language · Account
Menu toolbar: Menu             Menu QR · Categories · Tables · Add item · Search
Catalog column                        Cart column
All items | category | category       Your cart
Small photo cards                     Items, quantities, note, total, checkout
```

- Place the Menu toolbar above both columns, close to the dashboard header. Its right side contains toolbar controls, with the cart beginning in the row below.
- Keep category tabs and menu items in the left column and the cart in the right column on wide screens. Stack the cart below the catalog on phones. Keep the desktop cart available while scrolling.
- Use compact, text-only shadcn line tabs for workspace categories, including All items. Support horizontal scrolling and keyboard selection. The public customer menu retains its existing category-filter composition.
- Show five item columns from the desktop `xl` breakpoint. Use four at `lg`, three at `md`, and two on smaller screens. Check the five-column layout with the sidebar both expanded and collapsed.
- Keep cards small and consistent: a 4:3 photo, authored name and optional description, final MMK price, availability, and an add-to-cart action beside the price. Wrap long names, prices, and status labels within the card.
- Owners manage an item through one opaque **three-dot button at the photo's top-right corner**. Open a shadcn DropdownMenu containing Edit and Delete. Delete opens the existing removal confirmation. This menu is visible only to owners.
- Keep cart contents intact when searching or switching category tabs. Show quantities, removal, notes, and the total clearly, with one primary checkout action. Render prices using the shared MMK formatter and tabular numerals.
- Use the store's existing table tiles and Takeaway for counter-order destination selection.

## Customer menu layout

- In All items, show a Signature items section first when any exist, then nonempty category sections in the category strip's existing creation order. Keep item creation order within each section; do not rank by name, price, availability, or popularity.
- Use ordinary photo cards and the current responsive grid/cart layout. Section headings are h3 and customer item names are h4. Keep search and category selection instant, with no entrance staggering or animated reordering.
- Owners can select several signature items through the Add/Edit item dialog. Show a small translated Signature badge on marked customer and workspace cards. Authored names and category labels remain unchanged.
- Signature items also appear in their usual categories; both cards add to the same cart entry. A selected category shows only its own section. Search filters the active sections, and empty sections are omitted.
- Keep unavailable signature items visible with their availability status and disabled cart action. Live changes, filtering, and language changes preserve cart quantities and notes.
- Manual ordering, popularity ranking, and automated recommendations belong to future work.

## Overview revenue reports

- Owners see a compact Revenue reports section directly below the Overview toolbar. Keep the existing menu/team metrics and subscription summary below it; staff retain their operational Overview without financial queries.
- Use Day/Month line tabs, a labeled date/month input and a Today/This month reset. Default to the current day using server dates in Asia/Yangon. Refresh automatic current periods at Yangon midnight and on foreground/reconnect; preserve explicitly selected historical periods.
- Show separate Collected, Refunded, Net collected and Unpaid now metric cards. Collections and completed refunds belong to their financial event periods. Net may be negative. Unpaid now is the current outstanding amount/count across all dates, independent of the selected period.
- Collections, Refunds and Unpaid tables use shadcn primitives, contained horizontal scrolling and server-side Load more pagination. Financial rows are newest-first; unpaid bills are oldest-first. Date/period and table changes are instant.
- Each bill opens a controlled read-only order detail with the full submitted bill, notes, fulfillment/payment badges and existing financial/audit history. Keep the dialog outside the tables so live removals do not close it. Restore focus to the row trigger or the table heading when its row leaves.
- Show preparation feedback while reporting backfill is incomplete instead of partial totals. Keep existing disconnected feedback visible; report query results remain in Convex subscriptions.

## Orders layout

- Keep the Orders title and compact sound toggle in one toolbar. Put new-order notifications and Mark all seen directly below it.
- Use shadcn line tabs for Live orders and History. History includes served and cancelled orders, with a compact All/Served/Cancelled select and newest-first pagination. Live orders has Pending, Cooking, and Awaiting cash lanes with counts and empty states. Awaiting cash contains served unpaid orders.
- Show three equal lanes when the content area is at least 900px wide. Below that, use horizontally scrolling status tabs and one lane at a time. Default to Pending and preserve the selection during realtime changes.
- Use compact tickets with 16px padding, a prominent table/Takeaway/Unassigned label, short bill ID, creation time, source, payment status, and new-order indicator. Show all items and notes, with an emphasized final MMK total.
- Each ticket exposes its next step as the primary action. Keep cash collection separately available for unpaid QR orders. Correct destination and Order history belong in an accessible top-right three-dot DropdownMenu.
- Keep workspace dialogs outside the lanes so realtime movement does not close them. Return focus to the opening control or its lane heading when the ticket moves or leaves.
- Board updates and keyboard actions stay instant. Use restrained pointer press feedback and short origin-aware popup transitions, respecting reduced motion.
- Owners cancel pending/cooking orders or record completed full refunds through the ticket's three-dot menu. Keep these controlled dialogs outside lanes. Require a reason and an explicit submit action; cancellation uses destructive styling. Returning a collected payment requires prior cancellation when active work would become underfunded.
- Cancellation stops preparation without implying a refund. Show collection and recorded-refund badges separately, retaining Served on refunded served orders. Reasons and financial references stay in authorized order history; private guest tracking shows only outcomes.
- Refund dialogs describe recording money already returned externally, show the full collection and reference, and offer Now or an earlier Asia/Yangon completion time. Preserve failure feedback and the exact command on uncertain retries. Audit history shows completion and recording times separately, with an explicit chronology-review message for refunds preceding late verification.

## Staff layout and access

- Use one compact Staff toolbar with a Create join link action, followed by shadcn line tabs for Staff and Join links. Adapt the users-table reference through the existing theme and components.
- Compose a reusable DataTable from shadcn Table and TanStack Table. Show the staff member's name/email, optional contact phone, joined date, status, and one three-dot row menu. Keep search, status filtering, sorting, and pagination instant; derive rows and counts directly from Convex queries.
- Owners deactivate or reactivate store access through a confirmation outside the table. Deactivation blocks operational access immediately, including open sessions, while preserving the account and history. A deactivated member cannot restore access through another invitation; only the owner can reactivate them.
- Create one single-use shareable link per staff member. Offer 1, 3, or 7-day expiry, defaulting to 7 days. Staff enter their own name, email and password, then an optional contact phone when joining. Phone is never a sign-in credential. Existing email-bound invitations retain their email restriction.
- Show and copy the private join URL immediately after creation. Store only its hash; explain that it must be copied before closing. Regenerate replaces the old link and returns a fresh URL. Owners can revoke pending links, and the table retains accepted, expired and revoked entries.
- On narrow screens, wrap the toolbar and pagination controls and contain table scrolling inside its surface. Keep row actions available, long identity text contained, visible keyboard focus, localized status text, and reduced-motion popup behavior. Dialogs remain controlled outside paginated rows. Cancel returns focus to the row trigger; successful access/status changes focus the page heading before realtime filtering can remove the row. Regeneration keeps focus in its new-link result dialog.

## Forms and dialogs

- Use labeled shared fields with validation messages beside the affected input. Match adjacent control heights, corner radii, and spacing.
- The item category field uses the searchable shadcn Combobox and matches the Price input. Category labels remain exactly as authored.
- Item editors have a fixed heading, a scrollable form body, and one footer row. Place Cancel and the primary Add/Save action together, aligned to the right. Keep pending commands visible and disabled against duplicate submission.
- Photo fields show the preview, choose/replace action, removal control, and accepted file guidance in one upload area.
- Use shadcn AlertDialog for consequential confirmations. Preserve failure feedback and return keyboard focus to the opening control after cancellation.

## Language, accessibility, and live states

- Translate system navigation, buttons, validation, and status messages into English and Burmese. Display store names, categories, item names, and descriptions exactly as entered.
- Give icon-only controls translated accessible names; include the item name when several controls share an action. Preserve visible focus, dialog focus management, and tab/panel associations.
- Keep long Burmese labels and authored text inside their containers. Category strips may scroll horizontally; the page itself must fit the viewport.
- Present loading, empty, error, unavailable, offline, and disconnected states explicitly. Status meanings must remain available through text or accessible labels as well as color.
- Render persisted data directly from Convex queries. Keep transient selections and drafts in the existing client-state patterns; Convex query results remain the realtime source of truth.

## Verification

For UI changes, inspect the affected screen in Playwright with English and Burmese, light and dark themes, desktop sidebar states, and narrow phone widths such as 320px and 390px. Check text wrapping, control visibility, keyboard operation, filtering, and cart continuity where relevant. Save a screenshot showing the final result.

Run the relevant existing checks for changed behavior. Follow [development and verification](docs/development.md) when running account/order journeys against the dedicated local test backend.
