# Suppliers and Purchase Orders

Implemented in the confirmed Zera project folder. The feature is available under **Purchasing** when the Inventory module is enabled.

## Workflow

1. Add a supplier, including optional contact information and notes. Suppliers can be edited or made inactive.
2. Create a draft purchase order for an active branch. Choose active physical products, whole quantities and unit costs. The server computes and stores the total in the business currency.
3. Open a draft and choose **Edit draft** to change its supplier, branch, products, quantities, costs or note. Saving recalculates the total without changing stock. Outdated copies are rejected to protect another user's changes. An Owner or Manager approves the draft. Approval changes its status to ORDERED; it does not send a message or order to the supplier.
4. Choose **Receive delivery**, enter the quantities that arrived (or fill all outstanding quantities), and optionally record a delivery note/reference. Each delivery updates branch stock, records linked stock adjustments, and saves a receipt with its receiver and time in a single transaction. The order remains PARTIALLY_RECEIVED until every item arrives. Unchanged retries reuse a request key to prevent duplicate stock.
5. Owners and Managers can cancel draft or ordered purchases, or cancel the remainder of a partial order. Goods already received and their receipt history are retained. Fully received orders cannot be cancelled through this workflow.

Owners, Managers, Store Keepers and Pharmacists can use purchasing. Approval and cancellation require an Owner or Manager. Backend access checks enforce business membership, business status and Inventory module activation.

## Repeat purchases

Open a purchase and select **Order again** to prepare a new draft with its supplier, branch, original quantities and unit costs. Review prices before saving. Approval, receipts and the original note are not copied; the original order stays unchanged. Unavailable suppliers, branches and products must be replaced before saving. If the business currency has changed, a notice asks for corrected costs; no automatic conversion occurs. New orders open immediately after saving, even if current list filters exclude them.

The frontend production build passed for this workflow. Signed-in browser verification remains pending.

## Delivery progress

Order cards and desktop rows show a compact received-unit count. Open an order for an accessible progress bar and ordered, received and remaining quantities. Drafts show planned quantities; cancelled orders label the unreceived remainder as cancelled. These counts describe deliveries, not payments or current stock balances.

## Supplier directory

The Suppliers tab supports immediate search by name, email, phone or address and active/inactive filters. Cards show labelled contact fields and expandable notes. **View orders** opens all orders for that supplier and clears prior order filters. Inactive suppliers remain searchable for historical records.

## Finding orders

Creation-date filters are available with **Created from (UTC)** and **Created through (UTC)**. Select **Apply dates** to apply the range to both the list and CSV export. Either boundary may be left blank. The end date includes the entire UTC day. **Clear dates**, **Clear filters**, and supplier **View orders** reset the date range.

Verification on 29 September 2026: all **20 regression tests passed**, including full-day purchase date boundaries, open-ended ranges, invalid calendar dates, reversed ranges, and matching CSV results. The frontend production build passed. Signed-in browser verification of these controls remains pending.

Search by order number, supplier name or product name, then select **Search**. Combine supplier, branch and status filters; results and counts cover all pages. Inactive suppliers remain available for historical searches. **Clear filters** resets the view. Filtering is restricted to the current business.

## Exporting purchases

Choose **Export CSV** to download every order matching the applied search, supplier, branch and status filters, across all pages. The export includes currency, original order total and ordered/received/outstanding/cancelled units. Cancelled units are excluded from outstanding units. This is an order register, not a payment or expense report. Creation dates use UTC; records created after export starts are excluded. Changes made during a long export can still appear as batches are read. Spreadsheet formula-like text is escaped.

## Printing purchase orders

Open an order and select **Print order / PDF**. A separate preview shows supplier details, delivery branch, original quantities, unit costs, totals and notes. Choose **Print / Save PDF** in that preview, then use the browser print destination. Allow pop-ups for Zera if the preview is blocked. Draft and cancelled documents are explicitly marked. Printing does not approve an order or send it to a supplier.

The sample document layout was visually checked in a browser. Four non-database tests passed, including two print-specific tests for escaped content and status notices; the frontend build passed. The signed-in print flow and actual PDF pagination remain to be verified.

## Setup

The source includes migrations `20260917120000_add_purchasing` and `20260919120000_partial_purchase_receipts`. The latter backfills completed orders with their received quantities and historical receipts. Both have been applied and verified in the disposable test database and the configured local `zera_solutions` database. The local database was backed up before migration. Before using Purchasing with another database, select that deployment's intended `DATABASE_URL`, follow its normal backup/deployment procedure, and run from the backend directory:

```sh
npx prisma migrate deploy
npx prisma generate
```

Restart the backend after migrating. Build or start the frontend with the normal project commands. The feature requires no new npm dependencies.

## Verification — 19 September 2026

- Full regression suite: **17 passed, 0 failed**. This count includes the parent API suite, 14 API scenarios and 2 utility tests.
- Purchasing API tests cover draft totals, role restrictions, inactive suppliers, duplicate items, negative costs, approval, cancellation, concurrent receipt, stock audit records, and complete rollback if a line cannot be received.
- CSV tests verify 260 orders across multiple batches, empty results, filters, role/tenant access, escaped text and cancelled quantities.
- Search tests verify pagination, case-insensitive matching, product names, combined filters, invalid inputs and business isolation.
- Draft editing tests cover recalculated totals, concurrent stale saves, invalid lines, role and tenant restrictions, and rejection after approval.
- Partial-delivery tests cover request validation, concurrent identical retries, conflicting deliveries, over-receipt prevention, completion and cancellation of the remainder.
- Snapshot tests export purchasing records and receipts, restore them into a fresh business, and repeat the import without duplication.
- Frontend production build passed during implementation; its existing large-bundle warning remains.
- The earlier full-receipt browser workflow was verified. The new partial-delivery form has passed the production build; browser verification of that form remains outstanding.
- Tests ran against `zera_project_test` on port 5548. The test suite does not reset or migrate the working business database.

Run utility tests from the project root with `npm test --prefix backend`. The API suite is opt-in:

```sh
ZERA_INTEGRATION=1 DATABASE_URL='postgresql://postgres:YOUR_TEST_PASSWORD@127.0.0.1:5548/zera_project_test' npm test --prefix backend
```

Use a disposable database with all project migrations applied. The suite intentionally leaves uniquely named test fixtures for inspection.

## Current boundaries

- Partial deliveries and receipt history are supported. Draft editing is supported before approval. Purchase returns are not implemented.
- Purchase costs are procurement records; they do not create a supplier payment, payable or Finance expense automatically.
- New purchasing mutations join the existing desktop sync queue transactionally when desktop sync is enabled. Cloud replay/conflict resolution remains unfinished across the application.
- Purchasing records are included in deployment snapshots. This does not establish that the desktop installer or a self-contained local database runtime is production-ready.

This completes the Suppliers and Purchase Orders work described above; it does not declare all Zera modules finished.
