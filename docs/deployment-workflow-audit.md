# Deployment workflow audit — 1 October 2026

Audit completed before implementation changes for the deployment-lifecycle request.

## Working foundation

- System Admin routes require authentication and SYSTEM_ADMIN authorization.
- Organization profile, package limits, modules, branding, receipt/tax, branches and role definitions are exported in a manifest.
- Build readiness checks active organization/package, branch, user and POS module.
- Electron packages the current frontend/backend, Prisma client, migrations and native PostgreSQL runtime. Native OS build guards exist.
- Managed first launch creates a loopback-only PostgreSQL cluster, applies migrations, provisions configuration and a newly entered owner account. Credentials are encrypted by OS secure storage.
- Tests cover packaged database creation, owner sign-in, workspace access, repeat-provisioning rejection, persistence and pre-upgrade backup copying.

## Incomplete or unsafe for the requested central workflow

1. No persistent build/deployment/installation records, event history, activation, licensing, heartbeats or update tracking.
2. Build runs inside an HTTP request, with no durable job history. Shared build folders allow concurrent customer builds to overwrite each other.
3. Artifact discovery uses name slugs and filename sorting, not organization identity, configuration fingerprint or build identity. Renames, identical names and old artifacts are unsafe.
4. Signing readiness is inferred from environment variables; no artifact signature/notarization verification.
5. Manifest omits users and integration credentials. Owner is entered again at installation; central user accounts are not provisioned. Central and local business IDs differ.
6. No integration configuration contract or secret distribution policy, license enforcement, activation revocation or controlled updates.
7. Startup checks some database models but not rendered frontend/backend readiness. No installation-success report or central status.
8. Desktop runs services while Electron runs. It is not an unattended Windows service/macOS daemon or multi-terminal server product.
9. Windows/Apple Silicon clean-machine acceptance and Mac signing remain external release gates.
10. Existing transactional data migration is separate; queue/snapshot utilities are not a verified synchronization service.

## Preserve and extend

Keep React, Express, Prisma/PostgreSQL and Electron. First introduce immutable configuration snapshots and persistent build history; serialize the shared build toolchain, bind downloads to build identity and checksum, and distinguish unsigned test output from distribution-ready output. Next add authenticated device enrollment/activation and health reports, extend configuration provisioning and owner enrollment, then implement agreed licensing/update policies and native deployment acceptance.

Presence is derived from last successful contact; missing contact alone does not prove the installation is broken. Build success must never imply installation/activation. Account passwords and integration secrets must not be copied into publicly shareable installer manifests.

## Deployment decisions

The user requested shared-server operation on 1 October. Shared HTTPS access is opt-in. First install and local operations remain available without central enrollment; enrollment is device reporting, not license activation. No external artifact publishing is configured.

## Implemented and verified after audit

- Persistent InstallerBuild records and configuration fingerprints; build requests return HTTP 202 and duplicate concurrent requests share the active job.
- Server worker uses a database advisory lock around the shared toolchain. Statuses are QUEUED, BUILDING, READY and FAILED; the UI labels these Build requested, Building, Ready for download and Failed.
- Artifacts are archived under build IDs, hashed with SHA-256, and matched to the current configuration/version before download. Old name-based downloads are no longer served by the download endpoint.
- UI polls build history and identifies changed configuration and unsupported host platforms. Artifact signatures are explicitly unverified, never inferred from environment variables.
- First-run local setup checks database models, backend health and frontend build presence. It presents Installation successful and a loopback URL; Open Zera opens the workspace. This does not register an OS service or report central activation.
- Validation: 31 backend tests passed without skips; 4 desktop tests passed; frontend production build and syntax/diff checks passed.
- A real build in the isolated test database passed the authenticated request → worker → download acceptance test. Downloaded bytes matched the recorded SHA-256 and byte size. This test created no customer deployment and changed no live shop records.

## Reporting, updates and shared access — 0.3.0

- Added persistent Installation and InstallationEnrollment records. System Admin issues random, one-use codes valid for 30 minutes. The server stores code/token hashes; the desktop stores its device credential encrypted using the OS keychain. Lost enrollment responses can be retried with the same saved credential. Reporting can be revoked separately from shop operations.
- Heartbeats run every minute and include version, service mode and a boolean local health result. Server timestamps determine presence: no report for over 3 minutes means Offline. The UI also shows Installed, Online, Needs attention, Disconnected and Update available. No sales, customer records or login passwords are sent in reports. Activated is deliberately not claimed.
- Update metadata and downloads require a device credential and match the device's organization, OS and architecture. Only a newer numeric application version from a READY build matching current configuration is offered. Downloads reject redirects and check byte count and SHA-256 before finalizing. An update is never executed automatically; distribution signing remains unverified. Configuration-only changes do not re-provision an existing shop.
- Added Application → Connection & services with enrollment, update checks/downloads and shared-server settings. Remote central reporting requires HTTPS; loopback HTTP is allowed for local tests.
- Shared mode serves frontend and API over HTTPS on a selected stable port, while PostgreSQL remains loopback-only. Certificate hostname, dates and key compatibility are checked. Private key/settings use OS secure storage. Port/certificate startup failures fall back to local access and report unhealthy shared services.
- Shared mode stays running after windows close and supports opening in the background at user sign-in. This is not a machine-boot daemon or Windows service, and logging out/quitting stops it. Login registration requires native acceptance; Electron documents that unsigned/unnotarized macOS applications may fail to register reliably: https://www.electronjs.org/docs/latest/api/app#appsetloginitemsettingssettings
- Database migration 20261001160000_installation_reporting was tested on the disposable database and then applied to the local Zera database.

## Remaining release gates

Licensing policy/enforcement, integration-secret provisioning, centrally provisioned staff accounts, verified distribution signatures and machine-boot service registration remain incomplete. Shared access still requires administrator-provided DNS/certificates and OS firewall access; these are not yet supplied by a one-click deployment profile. Windows/Apple Silicon and clean-machine graphical installation acceptance are required. Stable organization-specific application identity, legacy data-directory migration after organization renames, rollback and signed automatic updates must be completed before unattended upgrades are enabled. Interrupted child build processes and multi-host build isolation also need a dedicated supervised-worker design before production deployment.
