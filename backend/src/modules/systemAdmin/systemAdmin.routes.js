import { businessFeatures } from "../../config/businessFeatures.js";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { execFile } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readdir, writeFile, readFile, copyFile, stat } from "node:fs/promises";
import { configurationDigest, artifactDigest, publicBuild } from '../../utils/installerArtifacts.js';
import { windowsBuilderConfig, windowsBuilderStatus, buildOnWindows } from '../../utils/windowsBuilder.js';
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireSystemAdmin } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";
import { getDefaultStaffRoleName } from "../../utils/businessRoles.js";
import { getMissingPlatformModules, moduleCatalog, normalizePOSMode } from "../../config/platformCatalog.js";
import {
  findPlatformBusinessType,
  findPlatformPackage,
  getModuleSetupForPackage,
  getPlatformSetupConfig,
  getRolesForBusinessType
} from "../../utils/platformSetup.js";
import { assertBusinessFitsPackage, assertCanCreateBranch, assertCanCreateBusinessUser } from "../../utils/packageLimits.js";
import { enqueueSyncOperation } from "../../utils/syncQueue.js";
import { installationRouter, requireInstallation, newEnrollmentCode } from '../installations/installation.routes.js';
import { tokenDigest, publicInstallation, isNewerVersion } from '../../utils/installationStatus.js';

export const systemAdminRouter = Router();

systemAdminRouter.use(requireAuth, requireSystemAdmin);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../../..");
const desktopRoot = path.join(projectRoot, "desktop");
const desktopReleaseRoot = path.join(desktopRoot, "release");
const desktopManifestRoot = path.join(desktopRoot, ".system-admin-manifests");
const installerArtifactRoot = path.join(desktopRoot, '.installer-artifacts');
let workerRunning = false;

async function desktopVersion() {
  return JSON.parse(await readFile(path.join(desktopRoot, 'package.json'), 'utf8')).version;
}

export async function runInstallerWorker() {
  if (workerRunning || !prisma.installerBuild || process.env.ZERA_DESKTOP === 'true') return;
  workerRunning = true;
  try {
    await prisma.$transaction(async lock => {
      const [result] = await lock.$queryRaw`SELECT pg_try_advisory_xact_lock(729310022) AS locked`;
      if (!result.locked) return;
      await prisma.installerBuild.updateMany({where:{status:'BUILDING'},data:{status:'FAILED',error:'Build service restarted. Request a new build.',finishedAt:new Date()}});
      const platform = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : null;
      const targets = platform ? [{platform,architecture:process.arch}] : [];
      if (platform !== 'windows' && (await windowsBuilderStatus(await desktopVersion())).available) targets.push({platform:'windows',architecture:'x64'});
      if (!targets.length) return;
      const job = await prisma.installerBuild.findFirst({where:{status:'QUEUED',OR:targets},orderBy:{createdAt:'asc'}});
      if (!job) return;
      await prisma.installerBuild.update({where:{id:job.id},data:{status:'BUILDING',startedAt:new Date()}});
      try {
        if (await desktopVersion() !== job.appVersion) throw new Error('Application version changed before build.');
        const manifest = {...job.manifest, deploymentSlug:`${job.businessId}-${job.id}`};
        const folder = path.join(installerArtifactRoot, job.id);
        await mkdir(folder, {recursive:true,mode:0o700});
        const remote = job.platform === 'windows' && process.platform !== 'win32';
        const installer = remote ? await buildOnWindows({...job,manifest},folder) : await buildDesktopInstallerForBusiness(manifest, job.platform);
        const target = path.join(folder, installer.fileName);
        if (!remote) await copyFile(installer.filePath,target);
        const sha256 = await artifactDigest(target);
        const info = await stat(target);
        await prisma.installerBuild.update({where:{id:job.id},data:{status:'READY',fileName:installer.fileName,sha256,byteSize:info.size,finishedAt:new Date()}});
      } catch {
        await prisma.installerBuild.update({where:{id:job.id},data:{status:'FAILED',error:'Installer build failed. Check the build host and signing configuration, then retry.',finishedAt:new Date()}});
      }
    }, {timeout:45*60*1000,maxWait:5000});
  } catch (error) { console.error('Installer worker unavailable:',error.code || error.name); }
  finally { workerRunning = false; }
}

export function startInstallerWorker() {
  const timer = setInterval(() => { void runInstallerWorker(); }, 5000);
  timer.unref();
  void runInstallerWorker();
  return timer;
}
const desktopInstallerPlatforms = {
  mac: {
    script: "build:customer:mac",
    extension: ".dmg",
    suffix: "-mac-x64.dmg",
    contentType: "application/x-apple-diskimage"
  },
  windows: {
    script: "build:customer:win",
    extension: ".exe",
    suffix: "-win-x64.exe",
    contentType: "application/vnd.microsoft.portable-executable"
  }
};

const businessInclude = {
  branches: true,
  modules: true,
  roles: true,
  platformBusinessType: true,
  platformPackage: {
    include: {
      modules: true
    }
  },
  _count: {
    select: {
      products: {
        where: {
          status: "ACTIVE"
        }
      }
    }
  },
  memberships: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true
        }
      },
      role: true
    }
  }
};

const packageStatusValues = new Set(["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"]);

function normalizePackageLimit(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new HttpError(400, "Package limits must be whole numbers.");
  }

  return numberValue;
}

function normalizePackagePrice(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new HttpError(400, "Package price must be a valid positive number.");
  }

  return numberValue;
}

function normalizeOptionalText(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeHexColor(value) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^#[0-9A-F]{6}$/i.test(trimmed)) {
    throw new HttpError(400, "Brand colors must use a valid hex value.");
  }

  return trimmed.toUpperCase();
}

function normalizeTaxRate(value) {
  if (value === "" || value === null || value === undefined) {
    return 0;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 100) {
    throw new HttpError(400, "Tax rate must be between 0 and 100.");
  }

  return numberValue;
}

function normalizeBusinessTypeRoles(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((role) => ({
      name: role?.name?.trim(),
      description: role?.description?.trim() || ""
    }))
    .filter((role) => role.name && !["Owner", "Manager"].includes(role.name));
}

function normalizeCatalogModuleKeys(value) {
  const requestedModuleKeys = Array.isArray(value) ? value.map((key) => String(key).toUpperCase()) : [];
  const knownModuleKeys = new Set(moduleCatalog.map((moduleItem) => moduleItem.key));
  return [...new Set(requestedModuleKeys)].filter((key) => knownModuleKeys.has(key));
}

function normalizePackageKey(value = "") {
  const packageKey = String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return packageKey || "CUSTOM_PACKAGE";
}

function normalizeBusinessTypeKey(value = "") {
  const businessTypeKey = String(value)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return businessTypeKey || "CUSTOM_BUSINESS";
}

async function getAvailablePackageKey(value) {
  const baseKey = normalizePackageKey(value);
  let packageKey = baseKey;
  let suffix = 2;

  while (await prisma.platformPackage.findUnique({ where: { key: packageKey } })) {
    packageKey = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  return packageKey;
}

async function getAvailableBusinessTypeIdentity(keyValue, labelValue) {
  const baseKey = normalizeBusinessTypeKey(keyValue || labelValue);
  const baseValue = labelValue.trim();
  let businessTypeKey = baseKey;
  let businessTypeValue = baseValue;
  let suffix = 2;

  while (
    await prisma.platformBusinessType.findFirst({
      where: {
        OR: [{ key: businessTypeKey }, { value: businessTypeValue }]
      }
    })
  ) {
    businessTypeKey = `${baseKey}_${suffix}`;
    businessTypeValue = `${baseValue} ${suffix}`;
    suffix += 1;
  }

  return { key: businessTypeKey, value: businessTypeValue };
}

function slugifyDeploymentName(value = "zera-business") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "zera-business";
}

async function getDeploymentBusiness(businessId) {
  return prisma.business.findUnique({
    where: { id: businessId },
    include: {
      ...businessInclude,
      products: {
        select: {
          category: true
        }
      }
    }
  });
}

function getDeploymentReadiness(business) {
  const missing = [];
  const activeBranches = (business.branches || []).filter((branch) => branch.status === "ACTIVE");
  const activeUsers = (business.memberships || []).filter((membership) => membership.user?.status === "ACTIVE");
  const activeModules = (business.modules || []).filter((module) => module.active);
  const hasPOS = activeModules.some((module) => module.key === "POS");

  if (business.status !== "ACTIVE") {
    missing.push("Activate the organization.");
  }

  if (!business.platformPackage) {
    missing.push("Assign a package.");
  }

  if (!["ACTIVE", "TRIAL"].includes(business.packageStatus || "ACTIVE")) {
    missing.push("Resolve the package status.");
  }

  if (activeBranches.length === 0) {
    missing.push("Create or activate at least one branch.");
  }

  if (activeUsers.length === 0) {
    missing.push("Create at least one active user account.");
  }

  if (activeModules.length === 0) {
    missing.push("Enable at least one module.");
  }

  if (!hasPOS) {
    missing.push("Enable the POS module before installation.");
  }

  return {
    ready: missing.length === 0,
    missing,
    counts: {
      activeBranches: activeBranches.length,
      activeUsers: activeUsers.length,
      activeModules: activeModules.length
    }
  };
}

function buildDeploymentManifest(business) {
  const categories = [...new Set((business.products || []).map((product) => product.category).filter(Boolean))].sort((first, second) =>
    first.localeCompare(second)
  );
  const readiness = getDeploymentReadiness(business);
  const deploymentSlug = slugifyDeploymentName(business.name);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    deploymentMode: "OFFLINE_DESKTOP",
    applicationName: `ZERA - ${business.name}`,
    deploymentSlug,
    setupStatus: readiness,
    business: {
      id: business.id,
      name: business.name,
      type: business.type,
      typeKey: businessFeatures(business).typeKey,
      posMode: business.posMode,
      country: business.country,
      currency: business.currency,
      status: business.status
    },
    branding: {
      logoUrl: business.logoUrl,
      primaryColor: business.brandPrimaryColor,
      useBrandTheme: business.useBrandTheme,
      secondaryColor: business.brandSecondaryColor
    },
    receipt: {
      header: business.receiptHeader,
      footer: business.receiptFooter,
      contactPhone: business.contactPhone,
      contactEmail: business.contactEmail,
      address: business.address,
      taxName: business.taxName,
      taxRate: business.taxRate,
      taxEnabled: business.taxEnabled
    },
    package: {
      id: business.platformPackage?.id || null,
      key: business.platformPackage?.key || null,
      name: business.platformPackage?.name || null,
      status: business.packageStatus,
      limits: {
        branches: business.platformPackage?.maxBranches ?? null,
        users: business.platformPackage?.maxUsers ?? null,
        products: business.platformPackage?.maxProducts ?? null
      }
    },
    modules: (business.modules || []).map((module) => ({
      key: module.key,
      active: module.active
    })),
    branches: (business.branches || []).map((branch) => ({
      id: branch.id,
      name: branch.name,
      location: branch.location,
      status: branch.status
    })),
    roles: (business.roles || []).map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description
    })),
    categories,
    installers: {
      mac: {
        artifactName: `Zera-${deploymentSlug}-{version}-mac-x64.dmg`,
        platform: "macOS",
        kind: "desktop-installer"
      },
      windows: {
        artifactName: `Zera-${deploymentSlug}-{version}-win-x64.exe`,
        platform: "Windows",
        kind: "desktop-installer"
      }
    },
    supportFiles: {
      macSetupScript: {
        fileName: `zera-${deploymentSlug}-mac-setup.sh`,
        platform: "macOS",
        kind: "setup-script"
      },
      windowsSetupScript: {
        fileName: `zera-${deploymentSlug}-windows-setup.ps1`,
        platform: "Windows",
        kind: "setup-script"
      }
    },
    localDatabase: {
      provider: "postgresql",
      mode: "local",
      backupRequired: true
    },
    migration: {
      cloudReady: true,
      syncReady: true,
      localQueueReady: true
    }
  };
}

function buildMacSetupScript(manifest) {
  const manifestJson = JSON.stringify(manifest, null, 2);

  return `#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${manifest.applicationName}"
APP_DIR="\${ZERA_APP_DIR:-$HOME/Zera/${manifest.deploymentSlug}}"
CONFIG_DIR="$APP_DIR/config"
BACKUP_DIR="$APP_DIR/backups"

mkdir -p "$CONFIG_DIR" "$BACKUP_DIR"

cat > "$CONFIG_DIR/deployment-manifest.json" <<'ZERA_MANIFEST_JSON'
${manifestJson}
ZERA_MANIFEST_JSON

echo "Zera setup ready for ${manifest.business.name}."
echo "Configuration: $CONFIG_DIR/deployment-manifest.json"
echo "Backups: $BACKUP_DIR"
echo "Configuration folder ready."
`;
}

function buildWindowsSetupScript(manifest) {
  const manifestJson = JSON.stringify(manifest, null, 2);

  return `$ErrorActionPreference = "Stop"

$AppName = "${manifest.applicationName}"
$AppDir = if ($env:ZERA_APP_DIR) { $env:ZERA_APP_DIR } else { Join-Path $HOME "Zera\\${manifest.deploymentSlug}" }
$ConfigDir = Join-Path $AppDir "config"
$BackupDir = Join-Path $AppDir "backups"

New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

@'
${manifestJson}
'@ | Set-Content -Encoding UTF8 -Path (Join-Path $ConfigDir "deployment-manifest.json")

Write-Host "Zera setup ready for ${manifest.business.name}."
Write-Host "Configuration: $ConfigDir\\deployment-manifest.json"
Write-Host "Backups: $BackupDir"
Write-Host "Configuration folder ready."
`;
}

function buildDeploymentReadme(manifest) {
  const moduleList = manifest.modules
    .filter((module) => module.active)
    .map((module) => `- ${module.key}`)
    .join("\n") || "- No modules enabled";
  const branchList = manifest.branches.map((branch) => `- ${branch.name}${branch.location ? ` (${branch.location})` : ""}: ${branch.status}`).join("\n") || "- No branches configured";
  const missingList = manifest.setupStatus.missing.map((item) => `- ${item}`).join("\n") || "- No blocking setup items.";

  return `# ${manifest.applicationName} Setup

Generated: ${manifest.generatedAt}

## Business
- Name: ${manifest.business.name}
- Type: ${manifest.business.type}
- POS mode: ${manifest.business.posMode}
- Package: ${manifest.package.name || "Not assigned"} (${manifest.package.status || "No status"})
- Currency: ${manifest.business.currency}

## Enabled modules
${moduleList}

## Branches
${branchList}

## Setup readiness
${manifest.setupStatus.ready ? "Ready for installation." : "Review these items before installation:"}
${missingList}

## Installation
1. Open System Admin and select this organization.
2. Build the Mac or Windows desktop installer from the Desktop app tab.
3. Download the generated .dmg or .exe and install it on the customer computer.
4. Start Zera. The installer already contains this organization's configuration.
5. Enter the owner name, email and a new password to create the local workspace. The bundled database is prepared automatically.
6. Sign in with that owner account. Existing products, stock and transactions require a separate data migration; existing cloud passwords are not included.
`;
}

function sendDeploymentFile(res, fileName, contentType, body) {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(body);
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

function getDesktopInstallerPlatform(platform = "") {
  const normalizedPlatform = String(platform).toLowerCase();
  const platformConfig = desktopInstallerPlatforms[normalizedPlatform];

  if (!platformConfig) {
    throw new HttpError(400, "Choose mac or windows.");
  }

  return {
    key: normalizedPlatform,
    ...platformConfig
  };
}

async function findDesktopInstaller(manifest, platform) {
  const platformConfig = getDesktopInstallerPlatform(platform);

  if (!existsSync(desktopReleaseRoot)) {
    return null;
  }

  const expectedName = `Zera-${manifest.deploymentSlug}-${await desktopVersion()}-${platformConfig.key === 'mac' ? 'mac' : 'win'}-${process.arch}${platformConfig.extension}`;
  const releaseFiles = await readdir(desktopReleaseRoot, { withFileTypes: true });
  const matchingFiles = releaseFiles
    .filter((file) => file.isFile() && file.name === expectedName)
    .map((file) => file.name)
    .sort()
    .reverse();

  if (!matchingFiles.length) {
    return null;
  }

  return {
    fileName: matchingFiles[0],
    filePath: path.join(desktopReleaseRoot, matchingFiles[0]),
    platform: platformConfig.key,
    contentType: platformConfig.contentType,
    verification: {readyForDirectCustomerOpen:false,warning:'Distribution signature has not been verified.'}
  };
}

function getDesktopInstallerVerification(platform) {
  if (platform !== "mac") {
    const isSigned = Boolean(process.env.WIN_CSC_LINK || process.env.CSC_LINK);

    return {
      readyForDirectCustomerOpen: isSigned,
      warning: isSigned ? "" : "Windows installer is unsigned."
    };
  }

  const hasSigningIdentity = Boolean(process.env.ZERA_MAC_SIGN_IDENTITY || process.env.CSC_NAME || process.env.CSC_LINK);
  const hasNotarizationCredentials = Boolean(
    (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER) ||
      (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) ||
      (process.env.APPLE_KEYCHAIN && process.env.APPLE_KEYCHAIN_PROFILE)
  );
  const readyForDirectCustomerOpen = hasSigningIdentity && hasNotarizationCredentials;

  return {
    readyForDirectCustomerOpen,
    warning: readyForDirectCustomerOpen ? "" : "Mac installer is unsigned. Apple Developer signing and notarization are required for direct customer opening."
  };
}

async function buildDesktopInstallerForBusiness(manifest, platform) {
  const platformConfig = getDesktopInstallerPlatform(platform);
  if ((platform === 'windows' && process.platform !== 'win32') || (platform === 'mac' && process.platform !== 'darwin')) {
    throw new HttpError(409, 'Build this installer on its target operating system so the bundled database and Prisma engine match.');
  }

  if (!existsSync(path.join(desktopRoot, "package.json"))) {
    throw new HttpError(503, "Desktop installer project is not available on this server.");
  }

  await mkdir(desktopManifestRoot, { recursive: true });
  const manifestPath = path.join(desktopManifestRoot, `${manifest.deploymentSlug}-deployment-manifest.json`);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  try {
    await execFileAsync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ["run", platformConfig.script], {
      shell: process.platform === 'win32',
      cwd: desktopRoot,
      env: {
        ...process.env,
        ZERA_DEPLOYMENT_MANIFEST: manifestPath
      },
      timeout: 1000 * 60 * 12,
      maxBuffer: 1024 * 1024 * 20
    });
  } catch (error) {
    throw new HttpError(
      500,
      `Unable to build ${platformConfig.key === "mac" ? "Mac" : "Windows"} installer. ${error.stderr || error.message || ""}`.trim()
    );
  }

  const installer = await findDesktopInstaller(manifest, platformConfig.key);

  if (!installer) {
    throw new HttpError(500, "Installer build finished, but the output file was not found.");
  }

  return installer;
}

systemAdminRouter.get("/setup-catalog", async (_req, res, next) => {
  try {
    res.json(await getPlatformSetupConfig());
  } catch (error) {
    next(error);
  }
});

systemAdminRouter.post("/business-types", async (req, res, next) => {
  try {
    const { key, label, helper, posMode, defaultTableCount, defaultModuleKeys, roles, active } = req.body;

    if (!label?.trim()) {
      throw new HttpError(400, "Business type name is required.");
    }

    const selectedModuleKeys = normalizeCatalogModuleKeys(defaultModuleKeys?.length ? defaultModuleKeys : ["POS", "INVENTORY", "REPORTS"]);

    if (selectedModuleKeys.length === 0) {
      throw new HttpError(400, "Choose at least one default module.");
    }

    const tableCount =
      defaultTableCount === "" || defaultTableCount === null || defaultTableCount === undefined
        ? null
        : Number(defaultTableCount);

    if (tableCount !== null && (!Number.isInteger(tableCount) || tableCount < 0)) {
      throw new HttpError(400, "Default table count must be a whole number.");
    }

    const identity = await getAvailableBusinessTypeIdentity(key, label);

    const createdBusinessType = await prisma.platformBusinessType.create({
      data: {
        key: identity.key,
        value: identity.value,
        label: label.trim(),
        helper: helper?.trim() || "",
        posMode: normalizePOSMode(posMode, identity.value),
        defaultTableCount: tableCount,
        defaultModuleKeys: selectedModuleKeys,
        roles: normalizeBusinessTypeRoles(roles),
        active: typeof active === "boolean" ? active : true
      }
    });

    const catalog = await getPlatformSetupConfig();
    const businessType = catalog.businessTypes.find((type) => type.id === createdBusinessType.id);

    await enqueueSyncOperation({
      entityType: "platform_business_type",
      entityId: createdBusinessType.id,
      operation: "create",
      method: "POST",
      endpoint: "/api/system-admin/business-types",
      payload: {
        localId: createdBusinessType.id,
        active,
        defaultModuleKeys: selectedModuleKeys,
        defaultTableCount: tableCount,
        helper,
        key,
        label,
        posMode,
        roles
      },
      userId: req.user.id
    });

    res.status(201).json({ businessType, catalog });
  } catch (error) {
    next(error);
  }
});

systemAdminRouter.patch("/business-types/:businessTypeId", async (req, res, next) => {
  try {
    const { businessTypeId } = req.params;
    const { label, helper, posMode, defaultTableCount, defaultModuleKeys, roles, active } = req.body;

    const existingBusinessType = await prisma.platformBusinessType.findFirst({
      where: {
        OR: [{ id: businessTypeId }, { key: businessTypeId }, { value: businessTypeId }]
      }
    });

    if (!existingBusinessType) {
      throw new HttpError(404, "Business type not found.");
    }

    if (!label?.trim()) {
      throw new HttpError(400, "Business type name is required.");
    }

    const selectedModuleKeys = normalizeCatalogModuleKeys(defaultModuleKeys);

    if (selectedModuleKeys.length === 0) {
      throw new HttpError(400, "Choose at least one default module.");
    }

    const tableCount =
      defaultTableCount === "" || defaultTableCount === null || defaultTableCount === undefined
        ? null
        : Number(defaultTableCount);

    if (tableCount !== null && (!Number.isInteger(tableCount) || tableCount < 0)) {
      throw new HttpError(400, "Default table count must be a whole number.");
    }

    await prisma.platformBusinessType.update({
      where: { id: existingBusinessType.id },
      data: {
        label: label.trim(),
        helper: helper?.trim() || "",
        posMode: normalizePOSMode(posMode, existingBusinessType.value),
        defaultTableCount: tableCount,
        defaultModuleKeys: selectedModuleKeys,
        roles: normalizeBusinessTypeRoles(roles),
        active: typeof active === "boolean" ? active : existingBusinessType.active
      }
    });

    const catalog = await getPlatformSetupConfig();
    const businessType = catalog.businessTypes.find((type) => type.id === existingBusinessType.id);

    await enqueueSyncOperation({
      entityType: "platform_business_type",
      entityId: existingBusinessType.id,
      operation: "update",
      method: "PATCH",
      endpoint: `/api/system-admin/business-types/${businessTypeId}`,
      payload: {
        localId: existingBusinessType.id,
        active,
        defaultModuleKeys: selectedModuleKeys,
        defaultTableCount: tableCount,
        helper,
        label,
        posMode,
        roles
      },
      userId: req.user.id
    });

    res.json({ businessType, catalog });
  } catch (error) {
    next(error);
  }
});

systemAdminRouter.post("/packages", async (req, res, next) => {
  try {
    const { key, name, description, price, currency, billingCycle, maxBranches, maxUsers, maxProducts, defaultModuleKeys, active } = req.body;

    if (!name?.trim()) {
      throw new HttpError(400, "Package name is required.");
    }

    const selectedModuleKeys = normalizeCatalogModuleKeys(defaultModuleKeys?.length ? defaultModuleKeys : ["POS", "REPORTS"]);

    if (selectedModuleKeys.length === 0) {
      throw new HttpError(400, "Choose at least one module for this package.");
    }

    const packageKey = await getAvailablePackageKey(key || name);

    const createdPackage = await prisma.$transaction(async (tx) => {
      const packageRecord = await tx.platformPackage.create({
        data: {
          key: packageKey,
          name: name.trim(),
          description: description?.trim() || "",
          price: normalizePackagePrice(price),
          currency: currency?.trim().toUpperCase() || "UGX",
          billingCycle: billingCycle?.trim().toUpperCase() || "MONTHLY",
          maxBranches: normalizePackageLimit(maxBranches),
          maxUsers: normalizePackageLimit(maxUsers),
          maxProducts: normalizePackageLimit(maxProducts),
          active: typeof active === "boolean" ? active : true
        }
      });

      await tx.platformPackageModule.createMany({
        data: moduleCatalog.map((moduleItem) => ({
          packageId: packageRecord.id,
          moduleKey: moduleItem.key,
          active: selectedModuleKeys.includes(moduleItem.key)
        }))
      });

      return packageRecord;
    });

    const catalog = await getPlatformSetupConfig();
    const packageItem = catalog.packages.find((item) => item.id === createdPackage.id);

    await enqueueSyncOperation({
      entityType: "platform_package",
      entityId: createdPackage.id,
      operation: "create",
      method: "POST",
      endpoint: "/api/system-admin/packages",
      payload: {
        localId: createdPackage.id,
        active,
        billingCycle,
        currency,
        defaultModuleKeys: selectedModuleKeys,
        description,
        key,
        maxBranches,
        maxProducts,
        maxUsers,
        name,
        price
      },
      userId: req.user.id
    });

    res.status(201).json({ package: packageItem, catalog });
  } catch (error) {
    next(error);
  }
});

systemAdminRouter.patch("/packages/:packageId", async (req, res, next) => {
  try {
    const { packageId } = req.params;
    const { name, description, price, currency, billingCycle, maxBranches, maxUsers, maxProducts, defaultModuleKeys, active } = req.body;

    const existingPackage = await prisma.platformPackage.findFirst({
      where: {
        OR: [{ id: packageId }, { key: packageId }]
      }
    });

    if (!existingPackage) {
      throw new HttpError(404, "Package not found.");
    }

    if (!name?.trim()) {
      throw new HttpError(400, "Package name is required.");
    }

    const selectedModuleKeys = normalizeCatalogModuleKeys(defaultModuleKeys);

    if (selectedModuleKeys.length === 0) {
      throw new HttpError(400, "Choose at least one module for this package.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.platformPackage.update({
        where: { id: existingPackage.id },
        data: {
          name: name.trim(),
          description: description?.trim() || "",
          price: normalizePackagePrice(price),
          currency: currency?.trim().toUpperCase() || existingPackage.currency,
          billingCycle: billingCycle?.trim().toUpperCase() || existingPackage.billingCycle,
          maxBranches: normalizePackageLimit(maxBranches),
          maxUsers: normalizePackageLimit(maxUsers),
          maxProducts: normalizePackageLimit(maxProducts),
          active: typeof active === "boolean" ? active : existingPackage.active
        }
      });

      for (const moduleItem of moduleCatalog) {
        const moduleActive = selectedModuleKeys.includes(moduleItem.key);

        await tx.platformPackageModule.upsert({
          where: {
            packageId_moduleKey: {
              packageId: existingPackage.id,
              moduleKey: moduleItem.key
            }
          },
          update: { active: moduleActive },
          create: {
            packageId: existingPackage.id,
            moduleKey: moduleItem.key,
            active: moduleActive
          }
        });
      }

      const assignedBusinesses = await tx.business.findMany({
        where: { platformPackageId: existingPackage.id },
        select: { id: true }
      });

      for (const business of assignedBusinesses) {
        for (const moduleItem of moduleCatalog) {
          await tx.businessModule.upsert({
            where: {
              businessId_key: {
                businessId: business.id,
                key: moduleItem.key
              }
            },
            update: {
              active: selectedModuleKeys.includes(moduleItem.key)
            },
            create: {
              businessId: business.id,
              key: moduleItem.key,
              active: selectedModuleKeys.includes(moduleItem.key)
            }
          });
        }
      }
    });

    const catalog = await getPlatformSetupConfig();
    const updatedPackage = catalog.packages.find((packageItem) => packageItem.id === existingPackage.id);

    await enqueueSyncOperation({
      entityType: "platform_package",
      entityId: existingPackage.id,
      operation: "update",
      method: "PATCH",
      endpoint: `/api/system-admin/packages/${packageId}`,
      payload: {
        localId: existingPackage.id,
        active,
        billingCycle,
        currency,
        defaultModuleKeys: selectedModuleKeys,
        description,
        maxBranches,
        maxProducts,
        maxUsers,
        name,
        price
      },
      userId: req.user.id
    });

    res.json({ package: updatedPackage, catalog });
  } catch (error) {
    next(error);
  }
});

systemAdminRouter.get("/businesses", async (_req, res, next) => {
  try {
    let businesses = await prisma.business.findMany({
      include: businessInclude,
      orderBy: { createdAt: "desc" }
    });

    const missingRoleGroups = businesses
      .map((business) => {
        const expectedRoles = getRolesForBusinessType(business.platformBusinessType);
        const existingRoleNames = new Set((business.roles || []).map((role) => role.name));

        return {
          business,
          roles: expectedRoles.filter((role) => !existingRoleNames.has(role.name))
        };
      })
      .filter((group) => group.roles.length > 0);
    const missingModuleGroups = businesses
      .map((business) => ({
        business,
        modules: getMissingPlatformModules(business.modules)
      }))
      .filter((group) => group.modules.length > 0);

    if (missingRoleGroups.length > 0 || missingModuleGroups.length > 0) {
      for (const group of missingRoleGroups) {
        await prisma.role.createMany({
          data: group.roles.map((role) => ({
            ...role,
            businessId: group.business.id
          })),
          skipDuplicates: true
        });
      }

      for (const group of missingModuleGroups) {
        await prisma.businessModule.createMany({
          data: group.modules.map((module) => ({
            ...module,
            businessId: group.business.id
          })),
          skipDuplicates: true
        });
      }

      businesses = await prisma.business.findMany({
        include: businessInclude,
        orderBy: { createdAt: "desc" }
      });
    }

    res.json({ businesses });
  } catch (error) {
    next(error);
  }
});

systemAdminRouter.post("/businesses", async (req, res, next) => {
  try {
    const { business, owner, branch } = req.body;

    if (!business?.name || !owner?.name || !owner?.email || !owner?.password) {
      throw new HttpError(400, "Business name, owner name, owner email, and password are required.");
    }

    if (owner.password.length < 8) {
      throw new HttpError(400, "Owner password must be at least 8 characters.");
    }

    const ownerEmail = owner.email.toLowerCase();
    const existingOwner = await prisma.user.findUnique({
      where: { email: ownerEmail }
    });

    if (existingOwner) {
      throw new HttpError(409, "A user with the owner email already exists.");
    }

    const passwordHash = await bcrypt.hash(owner.password, 12);

    const platformBusinessType = await findPlatformBusinessType(business.type);
    const platformPackage = await findPlatformPackage(business.packageKey || business.packageId || business.platformPackageId || "STARTER");

    if (!platformBusinessType) {
      throw new HttpError(400, "Choose a valid business type.");
    }

    if (!platformPackage) {
      throw new HttpError(400, "Choose a valid package.");
    }

    if (platformPackage.active === false) {
      throw new HttpError(400, "Choose an active package for new businesses.");
    }

    const posMode = normalizePOSMode(platformBusinessType.posMode, platformBusinessType.value);

    const createdBusiness = await prisma.$transaction(async (tx) => {
      const newBusiness = await tx.business.create({
        data: {
          name: business.name.trim(),
          type: platformBusinessType.value,
          posMode,
          country: business.country || "Uganda",
          currency: business.currency || "UGX",
          logoUrl: normalizeOptionalText(business.logoUrl),
          brandPrimaryColor: normalizeHexColor(business.brandPrimaryColor),
          brandSecondaryColor: normalizeHexColor(business.brandSecondaryColor),
          contactPhone: normalizeOptionalText(business.contactPhone),
          contactEmail: normalizeOptionalText(business.contactEmail),
          address: normalizeOptionalText(business.address),
          receiptHeader: normalizeOptionalText(business.receiptHeader),
          receiptFooter: normalizeOptionalText(business.receiptFooter),
          taxName: normalizeOptionalText(business.taxName) || "VAT",
          taxRate: normalizeTaxRate(business.taxRate),
          taxEnabled: Boolean(business.taxEnabled),
          platformBusinessTypeId: platformBusinessType.id,
          platformPackageId: platformPackage.id,
          packageStatus: business.packageStatus || "ACTIVE",
          roles: {
            create: getRolesForBusinessType(platformBusinessType)
          },
          modules: {
            create: getModuleSetupForPackage(platformPackage)
          },
          branches: branch?.name
            ? {
                create: {
                  name: branch.name,
                  location: branch.location
                }
              }
            : undefined
        },
        include: {
          roles: true,
          branches: true,
          modules: true
        }
      });

      const firstBranch = newBusiness.branches?.[0];

      if (posMode === "TABLE_SERVICE" && firstBranch) {
        await tx.pOSTable.createMany({
          data: Array.from({ length: platformBusinessType.defaultTableCount || 8 }, (_, index) => ({
            businessId: newBusiness.id,
            branchId: firstBranch.id,
            name: `Table ${index + 1}`,
            seats: 4
          }))
        });
      }

      const ownerRole = newBusiness.roles.find((role) => role.name === "Owner");
      const ownerUser = await tx.user.create({
        data: {
          name: owner.name,
          email: ownerEmail,
          passwordHash,
          systemRole: "BUSINESS_USER"
        }
      });

      await tx.businessUser.create({
        data: {
          userId: ownerUser.id,
          businessId: newBusiness.id,
          roleId: ownerRole?.id
        }
      });

      return tx.business.findUnique({
        where: { id: newBusiness.id },
        include: businessInclude
      });
    });

    await enqueueSyncOperation({
      businessId: createdBusiness.id,
      entityType: "business",
      entityId: createdBusiness.id,
      operation: "system_admin_create",
      method: "POST",
      endpoint: "/api/system-admin/businesses",
      payload: {
        localId: createdBusiness.id,
        address,
        brandPrimaryColor,
        brandSecondaryColor,
        businessType,
        contactEmail,
        contactPhone,
        country,
        currency,
        logoUrl,
        name,
        owner: {
          email: ownerEmail,
          name: owner.name
        },
        packageId: platformPackage.id,
        packageStatus,
        receiptFooter,
        receiptHeader,
        taxEnabled,
        taxName,
        taxRate
      },
      userId: req.user.id
    });

    res.status(201).json({ business: createdBusiness });
  } catch (error) {
    next(error);
  }
});
systemAdminRouter.patch("/businesses/:businessId/system-settings", async (req, res, next) => {
  try {
    if (req.body.useBrandTheme !== undefined && typeof req.body.useBrandTheme !== "boolean") {
      return res.status(400).json({ message: "Appearance must be a boolean setting." });
    }
    const { businessId } = req.params;
    const {
      name,
      type,
      country,
      currency,
      logoUrl,
      brandPrimaryColor,
      brandSecondaryColor,
      contactPhone,
      contactEmail,
      address,
      receiptHeader,
      receiptFooter,
      taxName,
      taxRate,
      taxEnabled,
      packageKey,
      packageId,
      platformPackageId,
      packageStatus,
      status
    } = req.body;

    const existingBusiness = await prisma.business.findUnique({
      where: { id: businessId },
      include: businessInclude
    });

    if (!existingBusiness) {
      throw new HttpError(404, "Business not found.");
    }

    if (!name?.trim()) {
      throw new HttpError(400, "Business name is required.");
    }

    if (status && !["ACTIVE", "INACTIVE"].includes(status)) {
      throw new HttpError(400, "Business status must be ACTIVE or INACTIVE.");
    }

    if (packageStatus && !packageStatusValues.has(String(packageStatus).toUpperCase())) {
      throw new HttpError(400, "Package status must be Trial, Active, Payment due, Suspended, or Cancelled.");
    }

    const platformBusinessType = await findPlatformBusinessType(type?.trim() || existingBusiness.type);
    const requestedPackage = packageKey || packageId || platformPackageId || existingBusiness.platformPackageId || existingBusiness.platformPackage?.key || "STARTER";
    const platformPackage = await findPlatformPackage(requestedPackage);

    if (!platformBusinessType) {
      throw new HttpError(400, "Choose a valid business type.");
    }

    if (!platformPackage) {
      throw new HttpError(400, "Choose a valid package.");
    }

    const nextPOSMode = normalizePOSMode(platformBusinessType.posMode, platformBusinessType.value);
    const packageChanged = platformPackage.id !== existingBusiness.platformPackageId;

    if (packageChanged && platformPackage.active === false) {
      throw new HttpError(400, "Choose an active package before assigning it to this business.");
    }

    if (packageChanged) {
      await assertBusinessFitsPackage(businessId, platformPackage);
    }

    const updatedBusiness = await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: businessId },
        data: {
          name: name.trim(),
          type: platformBusinessType.value,
          posMode: nextPOSMode,
          country: country?.trim() || existingBusiness.country || "Uganda",
          currency: currency?.trim().toUpperCase() || existingBusiness.currency,
          logoUrl: normalizeOptionalText(logoUrl),
          useBrandTheme: req.body.useBrandTheme,
          brandPrimaryColor: normalizeHexColor(brandPrimaryColor),
          brandSecondaryColor: normalizeHexColor(brandSecondaryColor),
          contactPhone: normalizeOptionalText(contactPhone),
          contactEmail: normalizeOptionalText(contactEmail),
          address: normalizeOptionalText(address),
          receiptHeader: normalizeOptionalText(receiptHeader),
          receiptFooter: normalizeOptionalText(receiptFooter),
          taxName: normalizeOptionalText(taxName) || "VAT",
          taxRate: normalizeTaxRate(taxRate),
          taxEnabled: Boolean(taxEnabled),
          platformBusinessTypeId: platformBusinessType.id,
          platformPackageId: platformPackage.id,
          packageStatus: packageStatus ? String(packageStatus).toUpperCase() : existingBusiness.packageStatus || "ACTIVE",
          status: status || existingBusiness.status
        }
      });

      const expectedRoles = getRolesForBusinessType(platformBusinessType);
      const existingRoles = await tx.role.findMany({
        where: { businessId },
        select: { name: true }
      });
      const existingRoleNames = new Set(existingRoles.map((role) => role.name));
      const missingRoles = expectedRoles.filter((role) => !existingRoleNames.has(role.name));

      if (missingRoles.length > 0) {
        await tx.role.createMany({
          data: missingRoles.map((role) => ({
            ...role,
            businessId
          })),
          skipDuplicates: true
        });
      }

      if (packageChanged) {
        const packageModules = getModuleSetupForPackage(platformPackage);

        for (const moduleItem of packageModules) {
          await tx.businessModule.upsert({
            where: {
              businessId_key: {
                businessId,
                key: moduleItem.key
              }
            },
            update: {
              active: moduleItem.active
            },
            create: {
              businessId,
              ...moduleItem
            }
          });
        }
      }

      if (nextPOSMode === "TABLE_SERVICE") {
        const branches = await tx.branch.findMany({
          where: { businessId },
          include: {
            _count: {
              select: { tables: true }
            }
          }
        });

        for (const branch of branches) {
          if (branch._count.tables === 0) {
            await tx.pOSTable.createMany({
              data: Array.from({ length: platformBusinessType.defaultTableCount || 8 }, (_, index) => ({
                businessId,
                branchId: branch.id,
                name: `Table ${index + 1}`,
                seats: 4
              }))
            });
          }
        }
      }

      return tx.business.findUnique({
        where: { id: businessId },
        include: businessInclude
      });
    });

    await enqueueSyncOperation({
      businessId,
      entityType: "business",
      entityId: updatedBusiness.id,
        operation: "system_settings",
      method: "PATCH",
      endpoint: `/api/system-admin/businesses/${businessId}/system-settings`,
      payload: {
        localId: updatedBusiness.id,
        useBrandTheme: updatedBusiness.useBrandTheme,
        address,
        brandPrimaryColor,
        brandSecondaryColor,
        contactEmail,
        contactPhone,
        country,
        currency,
        logoUrl,
        name,
        packageId: platformPackage.id,
        packageStatus,
        receiptFooter,
        receiptHeader,
        status,
        taxEnabled,
        taxName,
        taxRate,
        type: platformBusinessType.value
      },
      userId: req.user.id
    });

    res.json({ business: updatedBusiness });
  } catch (error) {
    next(error);
  }
});

systemAdminRouter.get("/businesses/:businessId/deployment-manifest", async (req, res, next) => {
  try {
    const { businessId } = req.params;

    const business = await getDeploymentBusiness(businessId);

    if (!business) {
      throw new HttpError(404, "Business was not found.");
    }

    res.json({ manifest: buildDeploymentManifest(business) });
  } catch (error) {
    next(error);
  }
});

systemAdminRouter.get("/businesses/:businessId/deployment-package", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const platform = String(req.query.platform || "manifest").toLowerCase();
    const business = await getDeploymentBusiness(businessId);

    if (!business) {
      throw new HttpError(404, "Business was not found.");
    }

    const manifest = buildDeploymentManifest(business);
    const baseName = `zera-${manifest.deploymentSlug}`;

    if (platform === "mac") {
      sendDeploymentFile(res, `${baseName}-mac-setup.sh`, "text/x-shellscript; charset=utf-8", buildMacSetupScript(manifest));
      return;
    }

    if (platform === "windows") {
      sendDeploymentFile(res, `${baseName}-windows-setup.ps1`, "text/plain; charset=utf-8", buildWindowsSetupScript(manifest));
      return;
    }

    if (platform === "readme") {
      sendDeploymentFile(res, `${baseName}-setup-readme.md`, "text/markdown; charset=utf-8", buildDeploymentReadme(manifest));
      return;
    }

    if (platform === "manifest") {
      sendDeploymentFile(res, `${baseName}-deployment-manifest.json`, "application/json; charset=utf-8", JSON.stringify(manifest, null, 2));
      return;
    }

    throw new HttpError(400, "Choose mac, windows, manifest, or readme.");
  } catch (error) {
    next(error);
  }
});

systemAdminRouter.post('/businesses/:businessId/installations/enrollment', async (req,res,next) => {
  try {
    if (!await getDeploymentBusiness(req.params.businessId)) throw new HttpError(404,'Business was not found.');
    const code = newEnrollmentCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await prisma.installationEnrollment.create({data:{businessId:req.params.businessId,codeHash:tokenDigest(code),expiresAt}});
    res.setHeader('Cache-Control','no-store');
    res.status(201).json({code,expiresAt});
  } catch(error) { next(error); }
});
systemAdminRouter.delete('/businesses/:businessId/installations/:installationId', async (req,res,next) => {
  try {
    const changed = await prisma.installation.updateMany({where:{id:req.params.installationId,businessId:req.params.businessId},data:{revokedAt:new Date()}});
    if (!changed.count) throw new HttpError(404,'Installation was not found.');
    res.json({ok:true});
  } catch(error) { next(error); }
});

async function availableDeviceUpdate(device) {
  const business = await getDeploymentBusiness(device.businessId);
  if (!business) return null;
  const candidate = await prisma.installerBuild.findFirst({where:{businessId:device.businessId,platform:device.platform,architecture:device.architecture,status:'READY',configHash:configurationDigest(buildDeploymentManifest(business)),appVersion:await desktopVersion()},orderBy:{createdAt:'desc'}});
  // Configuration-only changes need a separate data migration; replacing the app does not re-provision a live shop.
  return candidate && isNewerVersion(candidate.appVersion,device.appVersion) ? candidate : null;
}
installationRouter.get('/update',requireInstallation,async (req,res,next) => {
  try {
    const build = await availableDeviceUpdate(req.installation);
    res.setHeader('Cache-Control','no-store');
    res.json({update:build ? {id:build.id,version:build.appVersion,fileName:build.fileName,sha256:build.sha256,byteSize:build.byteSize,automaticInstall:false,signatureVerified:false} : null});
  } catch(error) { next(error); }
});
installationRouter.get('/update/:buildId/download',requireInstallation,async (req,res,next) => {
  try {
    const build = await availableDeviceUpdate(req.installation);
    if (!build || build.id !== req.params.buildId || !build.fileName || path.basename(build.fileName) !== build.fileName) throw new HttpError(409,'This update is no longer available. Check again.');
    const filename = path.join(installerArtifactRoot,build.id,build.fileName);
    if (!existsSync(filename) || await artifactDigest(filename) !== build.sha256) throw new HttpError(409,'Update failed its integrity check. Contact your administrator.');
    res.setHeader('Content-Type','application/octet-stream');
    res.setHeader('Content-Length',String(build.byteSize));
    res.setHeader('Cache-Control','no-store');
    createReadStream(filename).on('error',next).pipe(res);
  } catch(error) { next(error); }
});

systemAdminRouter.get("/businesses/:businessId/installations", async (req,res,next) => {
  try {
    const business = await getDeploymentBusiness(req.params.businessId);
    if (!business) throw new HttpError(404, 'Business was not found.');
    const manifest = buildDeploymentManifest(business);
    const version = await desktopVersion();
    const digest = configurationDigest(manifest);
    const nativePlatform = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : null;
    const windowsBuilder = nativePlatform === 'windows' ? {available:true,architecture:process.arch,remote:false} : await windowsBuilderStatus(version);
    const builds = await prisma.installerBuild.findMany({where:{businessId:business.id},orderBy:{createdAt:'desc'},take:30});
    const devices = await prisma.installation.findMany({where:{businessId:business.id},orderBy:{createdAt:'desc'}});
    res.json({configuration:manifest.setupStatus.ready ? 'CONFIGURED' : 'DRAFT',missing:manifest.setupStatus.missing,
      devices:devices.map(device => ({...publicInstallation(device),updateAvailable:!device.revokedAt && builds.some(build => build.status === 'READY' && build.configHash === digest && build.appVersion === version && build.platform === device.platform && build.architecture === device.architecture && isNewerVersion(build.appVersion,device.appVersion))})),
      supportedPlatform:process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : null,
      supportedPlatforms:[...(nativePlatform ? [nativePlatform] : []),...(nativePlatform !== 'windows' && windowsBuilder.available ? ['windows'] : [])], windowsBuilder,
      architecture:process.arch, builds:builds.map(build => publicBuild(build,digest,version))});
  } catch(error) { next(error); }
});

systemAdminRouter.post("/businesses/:businessId/desktop-installers", async (req,res,next) => {
  try {
    const {platform='mac'} = req.body;
    getDesktopInstallerPlatform(platform);
    let architecture=process.arch;
    if (platform === 'mac' && process.platform !== 'darwin') throw new HttpError(409,'A Mac builder is required for macOS installers.');
    if (platform === 'windows' && process.platform !== 'win32') {
      const builder=await windowsBuilderStatus(await desktopVersion());
      if (!builder.available) throw new HttpError(409,builder.message);
      architecture=builder.architecture;
    }
    const business = await getDeploymentBusiness(req.params.businessId);
    if (!business) throw new HttpError(404,'Business was not found.');
    const manifest = buildDeploymentManifest(business);
    if (!manifest.setupStatus.ready) throw new HttpError(400,manifest.setupStatus.missing.join(' '));
    const configHash = configurationDigest(manifest);
    // Opening inventory is an immutable build-time snapshot, not live synchronization.
    manifest.catalog = {
      version: 1, capturedAt: new Date().toISOString(),
      products: await prisma.product.findMany({where:{businessId:business.id},select:{
        name:true,sku:true,barcode:true,type:true,category:true,unit:true,price:true,minimumPrice:true,status:true,
        inventoryStocks:{select:{branchId:true,quantity:true,reorderLevel:true}}
      }})
    };
    const appVersion = await desktopVersion();
    const build = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Business" WHERE id = ${business.id} FOR UPDATE`;
      const active = await tx.installerBuild.findFirst({where:{businessId:business.id,platform,status:{in:['QUEUED','BUILDING']}}});
      if (active) return active;
      return tx.installerBuild.create({data:{businessId:business.id,platform,architecture,appVersion,configHash,manifest,createdById:req.user.id}});
    });
    res.status(202).json({installer:publicBuild(build,configHash,appVersion)});
  } catch(error) { next(error); }
});

systemAdminRouter.get("/businesses/:businessId/desktop-installers/:platform/download", async (req,res,next) => {
  try {
    const {businessId,platform} = req.params;
    const platformConfig = getDesktopInstallerPlatform(platform);
    const business = await getDeploymentBusiness(businessId);
    if (!business) throw new HttpError(404,'Business was not found.');
    const configHash = configurationDigest(buildDeploymentManifest(business));
    const version = await desktopVersion();
    const build = await prisma.installerBuild.findFirst({where:{businessId,platform,status:'READY',configHash,appVersion:version,...(req.query.buildId ? {id:String(req.query.buildId)} : {})},orderBy:{createdAt:'desc'}});
    if (!build?.fileName) throw new HttpError(409,'Build an installer for the current configuration before downloading.');
    if (path.basename(build.fileName) !== build.fileName) throw new HttpError(409,'Invalid artifact record.');
    const artifact = path.join(installerArtifactRoot,build.id,build.fileName);
    if (!existsSync(artifact) || await artifactDigest(artifact) !== build.sha256) throw new HttpError(409,'Installer is missing or failed its integrity check. Build it again.');
    res.setHeader('Content-Type',platformConfig.contentType);
    res.setHeader('Content-Disposition',`attachment; filename="${build.fileName}"`);
    res.setHeader('X-Installer-SHA256',build.sha256);
    createReadStream(artifact).on('error',next).pipe(res);
  } catch(error) { next(error); }
});

systemAdminRouter.post("/businesses/:businessId/branches", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { name, location } = req.body;

    if (!name?.trim()) {
      throw new HttpError(400, "Branch name is required.");
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { platformBusinessType: true }
    });

    if (!business) {
      throw new HttpError(404, "Business was not found.");
    }

    await assertCanCreateBranch(businessId);

    const branch = await prisma.$transaction(async (tx) => {
      const createdBranch = await tx.branch.create({
        data: {
          businessId,
          name: name.trim(),
          location: location?.trim() || null
        }
      });

      const posMode = normalizePOSMode(business.posMode, business.type);

      if (posMode === "TABLE_SERVICE") {
        await tx.pOSTable.createMany({
          data: Array.from({ length: business.platformBusinessType?.defaultTableCount || 8 }, (_, index) => ({
            businessId,
            branchId: createdBranch.id,
            name: `Table ${index + 1}`,
            seats: 4
          }))
        });
      }

      return createdBranch;
    });

    await enqueueSyncOperation({
      businessId,
      branchId: branch.id,
      entityType: "branch",
      entityId: branch.id,
      operation: "system_admin_create",
      method: "POST",
      endpoint: `/api/system-admin/businesses/${businessId}/branches`,
      payload: {
        localId: branch.id,
        location,
        name
      },
      userId: req.user.id
    });

    res.status(201).json({ branch });
  } catch (error) {
    if (error.code === "P2002") {
      next(new HttpError(409, "A branch with this name already exists for this business."));
      return;
    }

    next(error);
  }
});

systemAdminRouter.patch("/businesses/:businessId/branches/:branchId/status", async (req, res, next) => {
  try {
    const { businessId, branchId } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      throw new HttpError(400, "Branch status must be ACTIVE or INACTIVE.");
    }

    const existingBranch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        businessId
      }
    });

    if (!existingBranch) {
      throw new HttpError(404, "Branch was not found.");
    }

    if (status === "ACTIVE" && existingBranch.status !== "ACTIVE") {
      await assertCanCreateBranch(businessId);
    }

    const branch = await prisma.branch.update({
      where: { id: existingBranch.id },
      data: { status }
    });

    await enqueueSyncOperation({
      businessId,
      branchId: branch.id,
      entityType: "branch",
      entityId: branch.id,
      operation: "system_admin_status",
      method: "PATCH",
      endpoint: `/api/system-admin/businesses/${businessId}/branches/${branchId}/status`,
      payload: {
        localId: branch.id,
        status
      },
      userId: req.user.id
    });

    res.json({ branch });
  } catch (error) {
    next(error);
  }
});

systemAdminRouter.post("/businesses/:businessId/users", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { name, email, password, roleName } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      throw new HttpError(400, "Name, email, and password are required.");
    }

    if (password.length < 8) {
      throw new HttpError(400, "Password must be at least 8 characters.");
    }

    await assertCanCreateBusinessUser(businessId);

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      throw new HttpError(409, "A user with this email already exists.");
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        platformBusinessType: true,
        roles: true
      }
    });

    if (!business) {
      throw new HttpError(404, "Business was not found.");
    }

    const expectedRoles = getRolesForBusinessType(business.platformBusinessType);
    const existingRoleNames = new Set((business.roles || []).map((role) => role.name));
    const missingRoles = expectedRoles.filter((role) => !existingRoleNames.has(role.name));

    if (missingRoles.length > 0) {
      await prisma.role.createMany({
        data: missingRoles.map((role) => ({
          ...role,
          businessId
        })),
        skipDuplicates: true
      });
    }

    const selectedRoleName = roleName?.trim() || getDefaultStaffRoleName(business);
    const role = await prisma.role.findFirst({
      where: {
        businessId,
        name: selectedRoleName
      }
    });

    if (!role) {
      throw new HttpError(400, "Selected role does not exist for this business.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const businessUser = await prisma.businessUser.create({
      data: {
        businessId,
        roleId: role.id,
        user: {
          create: {
            name: name.trim(),
            email: normalizedEmail,
            passwordHash,
            systemRole: "BUSINESS_USER"
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            createdAt: true
          }
        },
        role: true
      }
    });

    await enqueueSyncOperation({
      businessId,
      entityType: "business_user",
      entityId: businessUser.id,
      operation: "system_admin_create",
      method: "POST",
      endpoint: `/api/system-admin/businesses/${businessId}/users`,
      payload: {
        localMembershipId: businessUser.id,
        email: businessUser.user.email,
        name: businessUser.user.name,
        roleName: businessUser.role?.name || roleName
      },
      userId: req.user.id
    });

    res.status(201).json({ businessUser });
  } catch (error) {
    next(error);
  }
});

systemAdminRouter.patch("/businesses/:businessId/users/:membershipId/status", async (req, res, next) => {
  try {
    const { businessId, membershipId } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      throw new HttpError(400, "User status must be ACTIVE or INACTIVE.");
    }

    const targetMembership = await prisma.businessUser.findFirst({
      where: {
        id: membershipId,
        businessId
      },
      include: {
        role: true,
        user: true
      }
    });

    if (!targetMembership) {
      throw new HttpError(404, "Business user was not found.");
    }

    if (targetMembership.role?.name === "Owner" && status === "INACTIVE") {
      throw new HttpError(400, "The owner account cannot be deactivated here.");
    }

    if (status === "ACTIVE" && targetMembership.user.status !== "ACTIVE") {
      await assertCanCreateBusinessUser(businessId);
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetMembership.userId },
      data: { status },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true
      }
    });

    await enqueueSyncOperation({
      businessId,
      entityType: "business_user",
      entityId: targetMembership.id,
      operation: "system_admin_status",
      method: "PATCH",
      endpoint: `/api/system-admin/businesses/${businessId}/users/${membershipId}/status`,
      payload: {
        localMembershipId: targetMembership.id,
        status
      },
      userId: req.user.id
    });

    res.json({
      businessUser: {
        ...targetMembership,
        user: updatedUser
      }
    });
  } catch (error) {
    next(error);
  }
});
