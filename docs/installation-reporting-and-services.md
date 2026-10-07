# Installation reporting and shared access

## Connect an installed computer

1. Build/install an organization-specific Zera 0.3.0 package and complete local workspace setup.
2. In System Admin → Organizations → Installations, choose **Connect a computer**.
3. In the desktop app, open **Application → Connection & services**. Enter the central platform HTTPS address, a computer name and the enrollment code.
4. The computer appears centrally. A successful report updates its last-seen time every minute; after three minutes without a report it shows Offline.

Codes expire after 30 minutes and are single-use. Keep them private. **Disconnect reporting** revokes this computer's central credential; it does not delete its database, disable local accounts or stop the shop. Enrollment does not activate a license. A generic, unassigned desktop package cannot enroll in an organization.

## Updates

The desktop checks for updates during reporting and through **Check now**. The central administrator must build a newer application version for the same organization, operating system and processor architecture. Stale-configuration builds are not offered. Changed business settings alone are not an app update and are not automatically imported into an existing shop.

**Download update** asks for a destination, streams the installer and checks its size and SHA-256. A failed download never becomes the final file. The desktop does not execute downloaded installers. Distribution signatures are not yet verified; native signing, data-directory compatibility and rollback acceptance remain release gates. Do not assume a checksum is a publisher signature.

## Shared shop server

Under **Connection & services**, enable shared access, enter an HTTPS hostname and stable port (1024–65535), and choose a matching valid PEM TLS certificate and private key. Save and restart. Other computers access that HTTPS address in a browser using their local Zera accounts. The certificate must be trusted on those computers, DNS must resolve to the server, and the OS firewall must allow the selected port. Zera does not modify firewall rules or install a trust root.

The server exposes the application only; the embedded PostgreSQL database remains private to the host. Existing role, tenant and module checks still apply to API requests. A port conflict or invalid/expired certificate disables shared access while keeping local access available. Central health then shows Needs attention.

Closing windows keeps a configured shared server alive. **Start in the background when I sign in** registers the installed app with the operating system. Relaunching Zera opens its window again. Quitting Zera or signing out stops the server. This is user-session startup, not an unattended machine-boot service. Sleep, host shutdown and network loss also interrupt access.

Do not call this the final one-click shared-server installer yet: automated trusted-certificate provisioning, machine-level service installation, Windows/macOS native acceptance, signing, backup recovery and update rollback remain outstanding.

## Verification

- Backend integration coverage: enrollment/retry/replay rejection, business scope, heartbeat, token revocation, online/offline derivation and OS/architecture update filtering.
- Desktop coverage: endpoint restrictions, encrypted-store interface, offline reporting behavior, verified downloads, corrupt-download rejection, HTTPS certificate verification, frontend/API shared serving, invalid certificate rejection and port conflict.
- Existing standalone tests exercise database initialization, all migrations, owner login, repeat-provisioning rejection, backup and restart persistence.

The automated tests use temporary directories, generated test certificates and an isolated database. They do not enroll real customer devices or register startup services on the development computer.

### Results — 1 October 2026

- Full backend suite: 33 passed, no failures or skips.
- Desktop suite: 6 passed; the subsequently added HTTPS shared-server test also passed (7 distinct tests). Reporting/download tests were rerun alongside the HTTPS test and passed.
- Frontend production build and whitespace checks passed. The live login page was opened; authenticated System Admin visual testing was not performed in this session.
- Actual macOS x64 0.3.0 build → authenticated download passed for an isolated fixture organization. Build ID: `cmupgifna00027xkia2240tfu`; SHA-256: `eab5a618f9807d937d746eb2d700767b06620ee0d3dffdfa97b404fb854257f5`; size: 193,902,835 bytes. This is an unsigned test artifact, not a customer release.
- The real packaged runtime passed its two setup/provisioning/backup/restart tests in a fresh temporary database directory. This is runtime acceptance, not a graphical clean-machine installation or a native startup-registration test.
