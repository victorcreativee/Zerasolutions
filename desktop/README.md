# Zera Desktop

This package builds customer-specific Zera desktop installers.

## Build Mac Installer

```bash
cd ../frontend
npm run build

cd ../desktop
npm install
npm run build:mac
```

The `.dmg` is created in:

```text
desktop/release/
```

For customer distribution on macOS, the app must be signed and notarized with an Apple Developer account. Set one of these notarization credential groups before building:

```bash
export ZERA_MAC_SIGN_IDENTITY="Developer ID Application: Your Company (TEAMID)"
export APPLE_ID="you@company.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID"
```

or use App Store Connect API credentials:

```bash
export ZERA_MAC_SIGN_IDENTITY="Developer ID Application: Your Company (TEAMID)"
export APPLE_API_KEY="/absolute/path/AuthKey_KEYID.p8"
export APPLE_API_KEY_ID="KEYID"
export APPLE_API_ISSUER="ISSUER-ID"
```

Unsigned Mac builds are only for internal testing. macOS Gatekeeper will block direct opening for customers.

## Build Windows Installer

```bash
cd desktop
npm run build:win
```

Build Windows installers on Windows. System Admin running on a Mac or Linux server can now request and download Windows x64 installers through a connected Windows build service; see [Windows builds from a Mac](../docs/windows-build-from-mac.md). Direct local cross-OS packaging remains rejected because the native database and Prisma engines must match. Build Mac installers on the Mac architecture being shipped.

## First launch (version 0.2.0)

Install the app, enter the shop name, owner name, sign-in email and a password of at least 12 characters. Zera creates a private PostgreSQL 17 cluster, applies the packaged migrations and provisions the workspace. It checks the database, backend and frontend, then displays Installation successful and a loopback access address. Choose Open Zera to sign in. No Node.js, Docker or separate PostgreSQL installation is required on the shop computer.

The local address works only on this computer while Zera is running; it is not a LAN server or background OS service. Application → Access address shows the current address after a restart. Browser access uses the same local API port, with a server-provided API base.

The database listens only on loopback with SCRAM authentication and a random password. Connection credentials and the signing secret use Electron safeStorage. Database files remain in the OS application user-data directory across app upgrades. Only one app instance can run; shutdown stops the private database. Existing configured databases remain an advanced connection option and are not automatically migrated or imported.

For customer-specific installers set ZERA_DEPLOYMENT_MANIFEST to a manifest exported by System Admin before building. The app applies business identity, brand colors/logo, receipts/tax, package limits, branches, roles and module switches. The person installing creates a new owner login. Existing passwords, products, stock and transaction history are NOT embedded. Moving existing shop data requires a separate verified migration.

Before applying changed migrations to an existing managed installation, the app stops the database and retains a full cluster copy under userData/backups. These are pre-upgrade copies, not scheduled/off-device backups. They require the same PostgreSQL major version for recovery. Do not delete application user data to troubleshoot startup.

## Verification

Run npm test from desktop. The test creates only a temporary database, applies migrations twice, provisions branding and package settings, checks owner password/login and workspace API access, rejects repeat provisioning, copies a stopped-cluster backup and verifies persistence after restart.

Set ZERA_TEST_APP_ROOT to the packaged app's Contents/Resources/app directory to run the same test against packaged database binaries, Prisma client and backend files. The Mac x64 package passed this test on 1 October 2026. This is not a substitute for clean-machine installer and hardware acceptance.

The Mac artifact is unsigned unless signing credentials are configured. Apple Developer signing/notarization, Windows installation, Apple Silicon builds, OS keychain behavior on clean machines and printer acceptance still require verification. No GitHub upload/build workflow was added. Runtime production dependencies were audited separately; build-tool advisories remain.

Cloud synchronization, automatic off-device backups, retail retry deduplication, returns and till closing remain separate daily-use release gates. This installer does not complete those business features.
