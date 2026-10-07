# In-app notifications

A sidebar bell shows grouped active alerts for the selected business and branch. Checks run on navigation, window focus and every 60 seconds while visible. No email, SMS, push permission or external service is used; a locally running desktop backend can serve the alerts without internet.

- Inventory-enabled Owner, Manager, Store Keeper and Pharmacist accounts see out-of-stock and low-stock alerts. Active physical products without a stock row count as out of stock.
- Operations-enabled Owner and Manager accounts see a difference in the latest cash count for that branch. This is not a complete unresolved-discrepancy ledger. Its link opens the recorded date in Operations.
- Membership, branch ownership and module permissions are enforced by the API. No private product costs or user credentials appear in alert payloads.

Read IDs are stored only in this browser/device, scoped to user/business/branch. They are not synchronized across devices. Reading does not resolve a business issue. Current alerts remain listed until the underlying condition resolves. A changed stock snapshot has a new alert ID. This first version is a live condition feed, not durable event history; identical conditions recurring later may retain their local read status.

Regression tests cover tenant and branch rejection, cashier/stock-role filtering, module disabling and stock revision changes. Frontend production build passes. Include the new backend route and frontend bundle in the next Windows installer build.
