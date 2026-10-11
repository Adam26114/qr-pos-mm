# UI composition

The owner's chosen approach is to build reusable product UI on top of shadcn/ui. Apply it when adding screens, controls, feedback, or layout patterns.

## Where code belongs

- `packages/ui/src/components`: shadcn primitives installed with the repository's existing `base-vega` / Base UI configuration. Import through `@workspace/ui/components/*`.
- `packages/ui/src/composed`: reusable presentation patterns composed from those primitives. Import through `@workspace/ui/composed/*`.
- `apps/web/components`: product screens and domain-specific compositions. These own authentication, Convex subscriptions/mutations, form schemas, and system translations.

Use the existing shared patterns first:

- `TextField`: Field, label, Input, optional description, and accessible validation error. It forwards native input props and refs so React Hook Form can register it directly.
- `SubmitButton`: Button, a decorative Spinner, pending label, busy state, and disabled state. Defaults to form submission; pass `type="button"` for an asynchronous action outside a form.
- `Feedback`: Alert and its description, with assertive error or polite status semantics.
- `FormCard`: Card header, heading, description, content, and optional footer for account and onboarding forms.
- `ConfirmAction`: AlertDialog with an accessible title/description, cancel action, pending command, and failure feedback. Keeps the confirmation open if the command fails. Callers provide all copy and the authorized command; an optional trigger icon keeps the same accessible action label.
- `LoadingState`: Card, localized status text, and decorative Skeletons.
- `CatalogCard`: photo, authored title/description, price, status, and caller-supplied actions in a responsive Card. The compact POS variant keeps the cart action beside the price and accepts owner tools over the photo.
- `CatalogFilters`: accessible search and horizontally scrolling category buttons; callers supply labels, options, and transient filter state. `CatalogSearch` and `CatalogCategories` can be composed separately for a toolbar; the category tiles remain text-only.
- `CartItems`: item amounts, availability, accessible quantity/remove controls, or fixed reviewed quantities; callers provide entries, labels and handlers. Used by counter POS and the guest cart. The compact POS variant accepts caller-rendered thumbnails and grouped quantity controls.
- `DestinationTiles`: selectable options with pressed state for table/Takeaway dialogs. Callers own the available options, selection, and assignment command.
- `EditorDialog`: controlled Dialog with a localized title, description and Close action, keeping pending commands open.

## Composition rules

Compose controls and surfaces from the appropriate shadcn primitives: Input/Field for text entry, Card for grouped content, Alert for feedback, Badge for status, and Button for actions. Use native HTML for document landmarks and layouts.

Keep shared compositions independent of Convex, auth, Redux, and product translations. Callers supply translated labels and own data, validation, and commands. Convex remains the realtime source of truth.

Extract a repeated pattern when it centralizes meaningful styling, accessibility, or interaction behavior. Use primitives directly where a wrapper would only rename them. Add further primitives when a feature uses them.

Use theme tokens such as `bg-card`, `bg-primary`, `text-primary-foreground`, and `border-border`. Prefer component variants and `cn()` for consistent customization.

When adding a shared composition, migrate the existing callers that need it and verify their public browser journeys. Preserve field labels/error associations, ref forwarding, pending/disabled behavior, connectivity guards, responsive layouts, and Burmese/English system text.

## Example

```tsx
<TextField
  id="store-name"
  label={copy.storeName}
  {...register("name")}
  error={errors.name ? formError(errors.name.message, copy) : undefined}
/>
<SubmitButton pending={isSubmitting} pendingLabel={copy.working}>
  {copy.createStore}
</SubmitButton>
```

The form supplies its schema and online/connection guard. The shared compositions handle presentation and accessible controls.
