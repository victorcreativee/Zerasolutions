# Request Windows installers from a Mac

System Admin can request Windows x64 builds from macOS or Linux. With Docker Desktop running, it packages locally using electron-builder's Wine container, explicitly includes Windows PostgreSQL and Prisma binaries, and checks their presence before accepting the installer. If a remote Windows builder is configured, that service takes precedence. The customer's machine does not need developer tools.

## Local build through System Admin

Start Docker Desktop, then open Organizations → Installation → Windows → Build installer. The backend detects Docker; no per-organization command or environment variable is required. The first build downloads the packaging image and dependencies and can take up to 40 minutes. It uses the saved organization configuration and an opening catalog/stock snapshot captured when the build is requested.

Only an allowlisted staging directory and the artifact output directory are mounted into the container. Host environment files, shop databases, and the project root are not mounted. Staging and the container are removed after the build; failure diagnostics remain in the private build artifact folder. No artifact is published externally. Download is available through the existing System Admin endpoint after successful packaging and hashing.

This path still needs a real Windows installation test. Binary presence and successful packaging alone do not prove that installation and daily business operations work on the target machine.

## Optional remote Windows builder setup

1. Use a dedicated Windows x64 PC, VM or server. Install the project's supported Node/npm tooling and check out **the same Zera source revision** as the central server. Matching version numbers are checked automatically; source revisions must also match.
2. Run `npm ci` in backend, frontend and desktop. Generate the backend Prisma client with `npm run prisma:generate` in backend. Do not configure a production shop database on the builder.
3. Generate a random secret of at least 32 characters. Set `ZERA_WINDOWS_BUILDER_TOKEN` in the Windows process environment and start `node desktop/scripts/windows-build-service.mjs` from the repository root. The service binds only to `127.0.0.1:5070`. Use a dedicated checkout; do not run another packaging process there concurrently.
4. Connect it through a private tunnel or an HTTPS reverse proxy. For example, with Windows OpenSSH already configured, run `ssh -N -L 5070:127.0.0.1:5070 build-user@windows-host` on the Mac. Keep this connection and the builder running. Do not expose the plain HTTP port publicly.
5. On the central backend, set `ZERA_WINDOWS_BUILDER_URL=http://127.0.0.1:5070` for that tunnel (or the HTTPS origin of the builder), and the same `ZERA_WINDOWS_BUILDER_TOKEN`. Restart the backend. Never put the token in frontend environment variables or source control.
6. Open System Admin → Organizations → Installations. Once the builder is connected and its version matches, the Windows Build installer button is enabled. Request the build and download the resulting `.exe` through the existing authenticated download action.

The organization configuration and opening product/stock snapshot are sent to the trusted builder. Prepared configuration is removed after the request. The downloaded artifact remains in the central build archive. No staff passwords are transferred. This is installer generation, not ongoing data synchronization.

## Failure and release behavior

- Unreachable, unauthenticated, wrong-platform or mismatched-version builders cannot accept a new request through System Admin.
- One build runs at a time. Failed/disconnected builds are marked Failed and can be requested again; a partially downloaded artifact is removed.
- The central server verifies filename, size, SHA-256 and the Windows executable header. This is an integrity check, not Authenticode signature verification or a clean-machine installation test.
- Use the same checkout/version on both hosts when updating Zera. The build service does not fetch or execute arbitrary repositories or commands supplied in a request.
- Windows installation, local database provisioning, login, checkout and restart persistence must still pass acceptance on Windows before customer delivery. Signing remains separately configured and unverified by the current workflow.
- A GitHub Actions adapter is not included. This service supports a Windows machine/VM behind HTTPS or a private tunnel; it does not create cloud infrastructure automatically.

## Validation

`node --test backend/test/windows-builder.test.js` covers transport configuration and corrupt/truncated/oversized/misdirected artifacts using synthetic bytes. It does not claim a real Windows executable was built.
