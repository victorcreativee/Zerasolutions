#!/bin/bash
set -euo pipefail
trap 'echo "Windows packaging failed at line $LINENO" >&2' ERR
# Preserve npm diagnostics outside the disposable container and retry transient
# package-manager failures. Every ci attempt starts from the lockfile.
export npm_config_logs_dir=/output/npm-logs
export npm_config_fetch_retries=3
export npm_config_fetch_timeout=120000
export npm_config_audit=false
export npm_config_fund=false
install_dependencies() {
  local project="$1"
  local attempt
  for attempt in 1 2 3; do
    echo "Installing $project dependencies (attempt $attempt of 3)"
    if npm --prefix "$project" ci; then return 0; fi
    if [ "$attempt" -lt 3 ]; then sleep 5; fi
  done
  echo "Dependency installation failed for $project. See npm-logs in the build output." >&2
  return 1
}
mkdir -p /workspace
cp -R /source/. /workspace/
cd /workspace
node -e "const fs=require('fs');const p='backend/prisma/schema.prisma';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/provider = \"prisma-client-js\"/, 'provider = \"prisma-client-js\"\n  binaryTargets = [\"native\", \"windows\"]'));"
install_dependencies backend
install_dependencies frontend
install_dependencies desktop
cd desktop
PG_VERSION=$(node -p "require('./node_modules/embedded-postgres/package.json').version")
npm install --force --ignore-scripts --no-save --package-lock=false "@embedded-postgres/windows-x64@$PG_VERSION"
npm run build:frontend
npm run prisma:generate
ZERA_DEPLOYMENT_MANIFEST=/source/deployment.json npm run prepare:app
./node_modules/.bin/electron-builder --config .desktop-build/electron-builder.generated.json --win nsis --x64 --publish never -c.npmRebuild=false
test -f release/win-unpacked/resources/app/.desktop-build/backend/prisma-client/query_engine-windows.dll.node
find release/win-unpacked/resources/app/node_modules/@embedded-postgres/windows-x64 -name postgres.exe | grep -q .
(cd release/win-unpacked/resources/app && ZERA_DESKTOP=true NODE_ENV=production JWT_SECRET=packaging-validation-only-not-a-runtime-secret node --input-type=module -e 'await import("./.desktop-build/backend/src/app.js"); console.log("Packaged backend module check passed");')
cp release/*.exe /output/
