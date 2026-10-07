# Hosting and offline operation

The desktop runs its own PostgreSQL database, backend and frontend on loopback. Login, products, stock, checkout, receipts, customers, purchasing, reports and cash counts use that local database. Starting the application does not require central enrollment. Optional device reporting catches network failures and does not block local work.

## Prepared hosting deployment

`deploy/compose.yaml` builds the API and public website as separate images. PostgreSQL and the API have no published host port. The website binds to loopback port 8080; place the host's HTTPS reverse proxy in front of that port. This configuration is prepared and locally tested, not deployed publicly.

Set operator-owned environment values outside source control:

- `POSTGRES_PASSWORD`: a strong unique database password.
- `DATABASE_URL`: `postgresql://zera:<URL-encoded-password>@database:5432/zera`.
- `JWT_SECRET`: a unique random value of at least 32 characters.
- `PUBLIC_ORIGIN`: the site's HTTPS origin.

Run `docker compose -f deploy/compose.yaml up -d --build` only on the chosen hosting machine. The API applies committed migrations before startup, runs as a non-root user, and exposes `/ready` for database readiness. Configure the initial System Admin using the existing seed command with explicitly supplied credentials; do not use example passwords. Keep PostgreSQL backups outside its volume and test restoration before production deployment.

`ZERA_INSTALLER_WORKER=false` in the hosting image intentionally keeps packaging on the configured build workstation. The desktop continues working if the hosted platform is unavailable. Do not mount Docker's socket into the public API container.

## Updates

Release a new desktop version whenever executable code changes. Preserve migration files already shipped; add a new migration instead of modifying old SQL. The desktop makes a stopped-database backup before a schema change and refuses a database with newer, modified or incomplete migration records. It does not automatically run downloaded installers. Test upgrades against a copy of customer data before distribution.

Current limitations requiring release acceptance: Windows first-run and printing on real hardware; stable per-organization installation/data identity across business renames; an operator-tested restore procedure; verified installer signing; and unattended upgrade/rollback acceptance. These must not be treated as complete simply because an installer was generated.

## Optional cloud synchronization boundary

Device enrollment, heartbeats and update downloads currently work separately from business data synchronization. They do not synchronize products, sales or stock. The existing local queue and snapshot utilities are preparatory only; queue writes are currently best-effort and must not be treated as a recoverable transaction log.

Before enabling a paid cloud synchronization package, implement and test:

1. Server-side package entitlement and per-device credentials scoped to one organization.
2. An outbox written in the same database transaction as the business change, with stable event/device IDs and a schema version.
3. A server inbox with a unique device/event key, so retries commit once and acknowledge only after the server transaction succeeds.
4. Explicit ID mapping between central configuration IDs and independently provisioned local IDs.
5. Conflict rules: completed sales and stock movements are immutable events; catalog/settings edits need revision checks. Never replay raw HTTP requests blindly.
6. Resumable acknowledgements, bounded retries, visible failures and recovery after prolonged offline use. Local checkout must never wait for this process.
7. Tests for duplicated/out-of-order events, two devices, tenant isolation, revoked credentials, package expiry and interrupted transfers.

Until these gates pass, operate one authoritative shop dataset. Installer product transfer is a one-time opening snapshot, not ongoing synchronization. Do not enable simultaneous online and offline sales against the same stock expecting automatic reconciliation.
