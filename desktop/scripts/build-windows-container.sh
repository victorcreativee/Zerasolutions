#!/bin/bash
set -euo pipefail
trap 'echo "Windows packaging failed at line $LINENO" >&2' ERR
mkdir -p /workspace
cp -R /source/. /workspace/
cd /workspace
node -e "const fs=require('fs');const p='backend/prisma/schema.prisma';fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/provider = \"prisma-client-js\"/, 'provider = \"prisma-client-js\"\n  binaryTargets = [\"native\", \"windows\"]'));"
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix desktop ci
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
