# Business-type feature policy

`backend/src/config/businessFeatures.js` is the central policy for the newer Operations and notification capabilities. The workspace API returns the computed `features` object, and the interface consumes that object rather than organization names or IDs. API authorization still checks membership, role, branch and module access independently.

## Profiles

- Retail shop, supermarket, electronics shop and pharmacy: RETAIL profile with product/stock exception workflows when Operations is enabled.
- Bar and restaurant: TABLE_SERVICE profile; its table workflow is retained.
- Hotel: SERVICE profile; its front-desk workflow is retained.
- Unknown/custom type keys: service/table baseline based on POS mode, without automatically granting retail product-exception tools. Add explicit mappings to support another type profile.

POS pricing safeguards remain shared across all POS types. Daily sales and cash counts require both POS and Operations. Cash notifications use those same modules and remain owner/manager-only. Stock notifications require Inventory and the existing inventory roles. Disabled modules and suspended/cancelled packages do not grant these capabilities. Existing module assignment/package-limit checks remain responsible for package configuration.

Canonical linked type keys take precedence over display names. Legacy records resolve known exact type names/keys. Renaming a linked Retail shop label does not change its feature profile. New installer manifests preserve the key; fresh desktop provisioning recreates that type association. Existing installed shops require an updated application; no organization catalog/transaction data is shared by these rules.

This is a code-defined policy, not a new editable per-feature administration screen. Email/SMS delivery is not implemented by this change. Existing POS, inventory, sales and reporting endpoints retain their established module/role authorization.

Tests verify identical feature sets for two differently named retail organizations, canonical keys with renamed labels, service/table distinction, module/package gating, and desktop provisioning of a renamed retail type.
