import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(desktopRoot, "..");
const outputRoot = path.join(desktopRoot, ".desktop-build");
const frontendDist = path.join(projectRoot, "frontend", "dist");
const backendRoot = path.join(projectRoot, "backend");
const backendOutput = path.join(outputRoot, "backend");
const backendNodeModules = path.join(backendRoot, "node_modules");
const backendNodeModulesOutput = path.join(backendOutput, "node_modules");
const desktopPrismaClientOutput = path.join(desktopRoot, "node_modules", ".prisma");
const manifestPath = getManifestPath();
const manifest = manifestPath ? JSON.parse(await readFile(manifestPath, "utf8")) : null;
const deploymentSlug = manifest?.deploymentSlug || "zera-solutions";

if (!existsSync(frontendDist)) {
  throw new Error("Frontend build not found. Run npm --prefix ../frontend run build before preparing the desktop app.");
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(backendOutput, { recursive: true });
await cp(frontendDist, path.join(outputRoot, "frontend"), { recursive: true });
await cp(path.join(backendRoot, "src"), path.join(backendOutput, "src"), { recursive: true });
await cp(path.join(backendRoot, "prisma"), path.join(backendOutput, "prisma"), {
  recursive: true
});
await cp(path.join(backendRoot, "package.json"), path.join(backendOutput, "package.json"));
await cp(path.join(backendRoot, "package-lock.json"), path.join(backendOutput, "package-lock.json"));
await copyBackendPrismaClient();

if (manifestPath) {
  await cp(manifestPath, path.join(outputRoot, "deployment-manifest.json"));
}

await writeFile(path.join(outputRoot, "electron-builder.generated.json"), JSON.stringify(getBuilderConfig(manifest, deploymentSlug), null, 2));

console.log(`Prepared Zera desktop resources at ${outputRoot}`);

function getManifestPath() {
  const manifestArgIndex = process.argv.findIndex((argument) => argument === "--manifest");

  if (manifestArgIndex >= 0 && process.argv[manifestArgIndex + 1]) {
    return path.resolve(process.argv[manifestArgIndex + 1]);
  }

  if (process.env.ZERA_DEPLOYMENT_MANIFEST) {
    return path.resolve(process.env.ZERA_DEPLOYMENT_MANIFEST);
  }

  return null;
}

function getBuilderConfig(selectedManifest, slug) {
  const businessName = selectedManifest?.business?.name || "Zera Solutions";
  const productName = selectedManifest ? `Zera - ${businessName}` : "Zera Solutions";
  const macIdentity = process.env.ZERA_MAC_SIGN_IDENTITY || process.env.CSC_NAME || undefined;
  const macConfig = {
    target: "dmg",
    category: "public.app-category.business",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    notarize: hasAppleNotarizationCredentials() ? {} : false
  };

  if (macIdentity) {
    macConfig.identity = macIdentity;
  }

  return {
    asar: false,
    appId: "com.zera.solutions.desktop",
    productName,
    artifactName: `Zera-${slug}-\${version}-\${os}-\${arch}.\${ext}`,
    files: [
      "src/**/*",
      ".desktop-build/frontend/**/*",
      ".desktop-build/backend/**/*",
      ".desktop-build/backend/prisma-client/**/*",
      ".desktop-build/backend/node_modules/.prisma/**/*",
      ".desktop-build/backend/node_modules/@prisma/client/**/*",
      "node_modules/.prisma/**/*",
      ".desktop-build/deployment-manifest.json",
      "package.json"
    ],
    directories: {
      output: "release"
    },
    mac: macConfig,
    win: {
      target: "nsis"
    },
    nsis: {
      oneClick: false,
      allowToChangeInstallationDirectory: true
    }
  };
}

async function copyBackendPrismaClient() {
  const generatedPrismaClient = path.join(backendNodeModules, ".prisma");
  const prismaClientPackage = path.join(backendNodeModules, "@prisma", "client");

  if (!existsSync(generatedPrismaClient) || !existsSync(prismaClientPackage)) {
    throw new Error("Generated Prisma client not found. Run npm run prisma:generate before preparing the desktop app.");
  }

  await mkdir(path.join(backendNodeModulesOutput, "@prisma"), { recursive: true });
  await cp(generatedPrismaClient, path.join(backendNodeModulesOutput, ".prisma"), { recursive: true });
  await cp(path.join(generatedPrismaClient, "client"), path.join(backendOutput, "prisma-client"), { recursive: true });
  await cp(prismaClientPackage, path.join(backendNodeModulesOutput, "@prisma", "client"), { recursive: true });
  await rm(desktopPrismaClientOutput, { recursive: true, force: true });
  await cp(generatedPrismaClient, desktopPrismaClientOutput, { recursive: true });
}

function hasAppleNotarizationCredentials() {
  const hasAppStoreConnectApiKey = Boolean(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER);
  const hasAppleIdCredentials = Boolean(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID);
  const hasKeychainProfile = Boolean(process.env.APPLE_KEYCHAIN && process.env.APPLE_KEYCHAIN_PROFILE);

  return hasAppStoreConnectApiKey || hasAppleIdCredentials || hasKeychainProfile;
}
