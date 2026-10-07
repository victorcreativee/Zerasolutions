# Shop readiness audit — 1 October 2026

## Decision

Not yet approved for unattended daily business use. Automated API tests pass, but retry safety, recovery operations and deployment acceptance remain release gates. No live shop records were changed by this audit.

## Verified

- 28 tests passed, zero failed or skipped, with `ZERA_INTEGRATION=1` against the disposable `zera_project_test` database on port 5548.
- Discounted sale tax reconciles with finance and reports; simultaneous checkout cannot oversell the final unit.
- Duplicate table-bill payment and concurrent payment/cancellation are guarded. These checks do not establish retry safety for retail sale creation.
- Stock receiving and transfers preserve quantities under tested concurrency.
- Purchasing approval, partial receipt limits, receipt retry protection, cancellation, stale draft rejection, exports and snapshot import pass.
- Selected tenant isolation and role restrictions pass. New checks confirm shop users cannot access platform administration and inactive users lose API access.
- Brand color fallback and contrast tests pass. Browser logo upload/save and physical printing remain unverified.
- Production now refuses missing, default or short JWT signing secrets; both reject and accept cases are tested. Secret entropy remains an operator responsibility.
- Frontend production build passes, with a large-bundle warning.
- PostgreSQL custom-format backup restored into a separate `zera_restore_audit_20261001` database with `pg_restore --exit-on-error`. Sale counts matched at 7,192 and purchase-order counts at 967 at backup time. This proves a manual test restore, not scheduled or off-device backup readiness. Test dump: `/tmp/zera-readiness-20261001.dump`.

## Remaining release gates, in priority order

1. **Retail checkout retry protection.** `/pos/sales` generates a new receipt for each accepted request. Add a client transaction key, unique database constraint and replay behavior; verify a lost response/retry creates one sale and one stock deduction. Apply similar protection to manual stock receiving/transfers.
2. **Operational recovery.** Add scheduled retained backups, failure visibility, off-device copies and a documented restore/reconciliation procedure. Test sudden shutdown and disk/database failure on the intended installation.
3. **Returns and closing.** Existing sale voiding is not a partial return/refund workflow. Implement return quantities, refund records and permissions, stock disposition, and cash shift opening/closing with discrepancy reporting.
4. **Deployment.** Desktop currently requires a prepared PostgreSQL database. Database provisioning, migration/import, packaged launch and update/rollback acceptance are unfinished. macOS distribution requires signing/notarization. Windows installation has not been accepted on a shop machine.
5. **Offline behavior.** A queue and snapshot tools do not establish secure online replay, deduplication or conflict recovery. Agree whether the first release is a local single-site installation or a connected service before promising offline operation.
6. **Security operations.** Complete endpoint-level role/tenant acceptance, login throttling, password recovery and access-revocation policy, production HTTPS/secrets configuration and audit coverage.
7. **Shop acceptance.** Test actual scanner, receipt printer, cash drawer if used, two terminals if required, browser branding save/upload, opening stock, sales/voids, daily report totals, and reconnect/restart behavior. Payment method recording is not proof of card/mobile-money provider integration.
8. **Reporting boundaries.** Reports currently use UTC dates; implement and verify the shop's business timezone and close-of-day boundaries.

## Next implementation milestone

Close retail duplicate-sale protection first, then automate recovery and add returns/till closing. Run acceptance on the target shop hardware before declaring daily-use readiness. The operating system, terminal count, printer and offline requirement are still needed from the shop owner.
