# 0.3.2 — Windows retail acceptance candidate

Adrona build: `cmuydinut0001958r7kxsq9ze`

- Status: READY in the central installer build history.
- File: `Zera-build-cmuydinut0001958r7kxsq9ze-0.3.2-win-x64.exe`
- Size: 171,691,569 bytes.
- SHA-256: `0a1e5151551c4a7d3d76f869f33d2999feb8ad890cf458df9d666c64f23a214e`
- Catalog snapshot: 88 products, 79 active, 88 opening stock rows. The retry preserved the original requested snapshot; this is not a live synchronization export.

## Fixed

Windows packaging completed but an incorrect post-build check looked for Prisma in a discarded root dependency directory. It now checks the actual packaged backend client directory. The build also imports the packaged backend to verify module resolution before publishing READY. Failure logs retain stdout, stderr and exit information. Cash counts use the same Prisma runtime as the rest of the packaged backend.

Compatible backend and desktop runtime dependencies were patched. `npm audit --omit=dev` reports zero runtime advisories for both; development/build-tool advisories remain. The additive stock retry-protection migration was applied to the existing local database.

## Verification completed

- 61 backend tests passed, with integration tests using only the isolated test database.
- 9 desktop tests passed, including local database creation, migrations, provisioning, login, checkout replay, stock deduction, cash counts, restart persistence, backups, upgrade preflight and device-reporting network failures.
- The retail persistence test blocks external fetch requests and operates against a temporary local PostgreSQL instance.
- Windows PostgreSQL and Prisma binaries are present; packaged backend modules load; final executable header, byte size and SHA-256 verified.
- Hosting API and web images built. Non-root API startup and readiness passed against the isolated database. Nginx configuration passed validation. No public deployment was performed.

## Remaining acceptance

This is an unsigned Windows test candidate, not a production approval. Actual Windows setup, first launch, printer output, offline restart and customer hardware behavior remain to be tested using [the Windows checklist](windows-retail-acceptance.md). No Windows computer is connected to this task for direct testing.

Business-data synchronization is not implemented end-to-end. Device health/update reporting must not be represented as sales or stock synchronization. The prepared hosting deployment and synchronization boundary are documented in [hosting and offline operation](hosting-and-offline.md).

Before wider customer rollout, validate restore procedures and upgrades, stable installation identity across organization renames, signing, and the remaining Windows checks. Do not run independent online and offline sales against the same inventory expecting reconciliation.
