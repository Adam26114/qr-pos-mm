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
