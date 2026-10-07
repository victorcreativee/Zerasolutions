# Negotiated pricing

The existing product price is now the suggested selling price. Existing product prices are preserved; new minimum prices default to zero and private costs start unset.

## Products

- The Owner can enter a private cost in the product editor. A separate ProductCost relation prevents implicit product includes in inventory, sales and other endpoints from exposing it. Only an Owner membership in that business can read/write this cost through Products. Platform-admin access alone does not grant access to it.
- Suggested and minimum prices are visible to staff, with compact values in the product list. Staff cannot change pricing policy. Platform administrators retain suggested/minimum configuration access, but never private cost access through these routes.
- Staff can maintain ordinary product details without overwriting price policy. Private costs are excluded from shared snapshots and sync payloads; a complete database backup preserves them.

## POS

The selling-price input starts at the suggestion and remains editable. A zero suggestion requires entry. Cashiers/store keepers can negotiate at or above the minimum; below-minimum prices are rejected for all roles. There is no approval override in this version. A total discount cannot reduce the pre-tax sale below the sum of line minimums. The owner can revise minimums in Products.

New sale/order lines store the suggestion and minimum alongside the agreed price for audit. Negotiation leaves the catalog unchanged. Customer receipts print the agreed price, not cost or minimum. Existing historical lines retain null pricing-policy snapshots because their original policy cannot be reconstructed reliably.

Validation: 40 backend tests passed, including owner cost creation/clearing, staff and platform-admin read restrictions, staff write rejection, store-keeper negotiation, minimum and discount enforcement, catalog preservation, tax and stock regressions. No live sales or product-price changes were used for testing.
