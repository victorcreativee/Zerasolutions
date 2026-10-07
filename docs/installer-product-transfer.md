# Installer product transfer

New organization installer requests capture product names, SKU/barcode, type, category, unit, active/inactive status, suggested/minimum prices, and stock quantity/reorder level for each branch. The immutable build manifest carries this opening snapshot.

Fresh desktop provisioning creates local product IDs and maps source branch IDs to the new local branches within the same database transaction. Unknown stock branches or invalid quantities fail provisioning. Existing workspaces reject provisioning, so reopening or reinstalling does not add stock again. Upgrades never apply this opening snapshot to an existing shop.

No customers, sales, existing staff credentials or private owner costs are transferred. Owner setup remains part of first launch. Private costs can be entered locally by the owner; installers are inspectable files and must not carry those private values.

Products and stock are captured when Build Installer is requested, not when installed. Build again after stock changes before initial handover. The configuration fingerprint deliberately excludes this opening snapshot so normal sales do not invalidate installed configuration or update availability. Each requested build stores its own snapshot.

Verification: 9 desktop tests including transferred prices, branch stock and repeat-provisioning protection; backend installer regression suite; frontend build. Native Windows installer build and target-computer acceptance are still required. No Windows installer was produced by this change.
