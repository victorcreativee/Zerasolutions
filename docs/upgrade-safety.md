# Upgrade safety — 0.3.1

## Implemented

- Validate the complete managed-database migration history before applying pending migrations. Refuse unknown migrations (including opening a newer database with an older installer), checksum changes and unfinished migrations.
- Show a specific upgrade-stopped message instead of suggesting fresh workspace setup when this check fails. Existing shop data stays in place.
- Copy a stopped PostgreSQL cluster to a uniquely named `.incomplete` backup directory. Write the PostgreSQL version, timestamp and previous schema fingerprint, then rename the completed backup. An interrupted backup does not appear as completed. Backup credentials remain in OS secure storage.
- Bind persisted central device credentials to the organization ID. Reject mismatched or legacy unbound reporting credentials without transmitting them. Affected computers need a fresh enrollment code; their local workspace is unchanged.

## Remaining work

This is upgrade protection, not automated rollback. Backup restore still needs a controlled operator workflow and restore acceptance. Installer signing, Windows native acceptance and boot-time services remain open.

Legacy data locations depend on application naming and do not reliably record their central organization identity. They must not be automatically moved or assigned using shop names alone. Stable per-organization application identity and a verified legacy adoption/migration flow remain required before unattended updates or organization renames are supported as seamless upgrades.

## Verification — 3 October 2026

All nine desktop tests passed, including reporting credential scope, HTTPS, migration preflight and completed-backup metadata. The database acceptance test also injected a future migration, verified startup rejection without changing business/user records, removed that test-only record and verified normal migration checks again.

The isolated fixture organization's real macOS x64 installer passed build and authenticated download verification: build `cmusb0i6p00023dqhuab6vdzw`, version `0.3.1`, 193,903,025 bytes, SHA-256 `455ae440ee9d79730aba0d9de7563f0c19dd60b4a42e31dffd03b41d72faeccf`. This unsigned fixture build is not a customer release.
