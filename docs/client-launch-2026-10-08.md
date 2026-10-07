# First-client launch — 8 October 2026

Audit date: 7 October 2026. Target operating system and deployment method are awaiting confirmation. This is not a production approval.

## Verified in this audit

- 42 backend tests passed, zero failures or skips, against isolated PostgreSQL on port 5548. Includes checkout retries, concurrent stock deductions, negotiated pricing/minima, cost privacy, purchasing, finance and tenant/role checks.
- 9 desktop tests passed: local provisioning, persistence, migration preflight, pre-upgrade backup, local serving, shared HTTPS and installation reporting.
- Login now limits each client address to 30 attempts per minute and validates input types/lengths. The bounded in-memory limiter resets at restart and is intended for a single server; distributed deployment needs a shared limiter. Forwarded client headers are not trusted.
- No live sales, stock quantities, prices or user accounts were changed by this audit.

## Adrona configuration (read-only)

- Active business and branch; UGX; active Owner and Store Keeper accounts.
- POS, Inventory, Finance, Operations and Reports enabled.
- 88 products, 79 active.
- 78 active products have zero suggested price and zero minimum price. Checkout requires entering the actual positive price, but no owner-defined minimum applies until configured.
- 3 active physical products have no positive stock. Verify actual quantities before selling them; do not invent opening balances.

## Still required before client handover

1. Confirm the target computer/OS and whether this is the existing browser installation or a new desktop installation. Existing desktop artifacts predate the latest source changes.
2. Verify owner/store-keeper login, actual receipt printer/scanner, restart/recovery and a complete sale/report reconciliation on that target. Automated tests do not establish hardware acceptance.
3. Establish daily retained and off-device backups with a tested restore. Current desktop pre-upgrade backups are not daily operational backups.
4. Set owner-approved suggested/minimum prices, or explicitly accept manual pricing without minimum protection. Confirm opening quantities.
5. A fresh installer does not automatically migrate existing central products, transactions and staff credentials. Data migration is a separate release requirement.

## Features not completed

Partial returns/refunds, cash-shift opening/closing, scheduled operational backups and restore UI, secure connected/offline synchronization, licensed activation, fully automated shared-server setup, signed native installer acceptance, and timezone-aware reporting remain incomplete. Full sale voiding exists but is not a partial refund process. Card/mobile-money payment labels record tender type; they are not payment-provider integrations. Reports use UTC date boundaries.

Do not describe the entire system as finished or deliver an untested installer as production-ready. The deployment decision determines the next implementation and acceptance work.
