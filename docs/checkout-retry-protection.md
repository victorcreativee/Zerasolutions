# Checkout retry protection — 5 October 2026

Retail POS creates a random request ID for a checkout attempt. A synchronous in-flight guard prevents double-click submissions. When the response fails, retrying the unchanged cart in the same POS session retains that request ID. A successful response clears it so the next sale can have identical items and still be a new sale.

The API binds the request to the business, cashier, branch, customer, payment method, discount and submitted line items/prices. Reuse with changed details is rejected. A database transaction lock serializes requests for the same ID; the business/request unique index also prevents duplicate records. Replays return the original stored sale, without deducting stock or queuing synchronization again. Failed transactions leave no request record, allowing retry after the cause is corrected.

The offline synchronization payload now retains each line's unit price and a stable request ID. This preserves manually entered prices when the receiving catalog also uses price-at-checkout.

## Limits

- An unconfirmed retail checkout is saved in browser session storage before submission. Reloading the same tab restores its cart, manually entered prices, payment method, discount, customer selection and request ID. It never submits automatically. Storage is scoped to the cashier, organization and branch. Closing the browser tab/session can remove this recovery information; check Sales before recreating an uncertain checkout in a new session.
- Changed details cannot silently replace an unresolved request. The cashier must check Sales and explicitly clear recovery and the cart before starting a different sale. Corrupt recovery information also blocks checkout until acknowledged. Failure to save recovery information prevents submission.
- Ordinary carts that have never been submitted are not saved by this mechanism. This is checkout recovery, not full offline sales or cross-device cart synchronization.
- Existing clients without request IDs remain compatible and do not gain retry protection until updated.
- This change covers direct retail sales. Sending restaurant orders and external payment-provider retries need their own controls.
- The desktop installer must be rebuilt to include these source changes and the new migration.

## Validation

36 backend tests passed without failures/skips, including concurrent duplicate requests, altered-request rejection, business/cashier scope, preserved manual prices after catalog changes, one stock deduction and successful retry after an initial stock failure. Frontend production build and whitespace checks passed. No test sale was recorded in the live shop database.
