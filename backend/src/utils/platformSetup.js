import { prisma } from "../config/prisma.js";
import { baseBusinessRoles, businessTypeCatalog, moduleCatalog, packageCatalog } from "../config/platformCatalog.js";

function parseJsonArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function normalizeBusinessType(record) {
  return {
    id: record.id,
    key: record.key,
    value: record.value,
    label: record.label,
    posMode: record.posMode,
    helper: record.helper,
    defaultTableCount: record.defaultTableCount,
    defaultModuleKeys: parseJsonArray(record.defaultModuleKeys),
    roles: parseJsonArray(record.roles),
    active: record.active
  };
}

function normalizePackage(record) {
  const defaultModuleKeys = (record.modules || []).filter((module) => module.active).map((module) => module.moduleKey);

  return {
    id: record.id,
    key: record.key,
    name: record.name,
    description: record.description,
    price: record.price === null || record.price === undefined ? null : Number(record.price),
    currency: record.currency,
    billingCycle: record.billingCycle,
    maxBranches: record.maxBranches,
    maxUsers: record.maxUsers,
    maxProducts: record.maxProducts,
    defaultModuleKeys,
    modules: record.modules || [],
    active: record.active
  };
}

function findMatchingBusinessType(type = "", businessTypes = []) {
  const normalizedType = type.toLowerCase();

  return (
    businessTypes.find((item) => item.value === type || item.key === type) ||
    businessTypes.find((item) => normalizedType && (normalizedType.includes(item.value.toLowerCase()) || item.value.toLowerCase().includes(normalizedType))) ||
    businessTypes.find((item) => item.key === "RETAIL_SHOP")
  );
}

function pickPackageForBusiness(activeModuleKeys = [], packages = []) {
  const activeKeys = new Set(activeModuleKeys);
  const rankedPackages = [...packages].sort((first, second) => first.defaultModuleKeys.length - second.defaultModuleKeys.length);

  return rankedPackages.find((packageItem) => [...activeKeys].every((moduleKey) => packageItem.defaultModuleKeys.includes(moduleKey))) || rankedPackages[0];
}

export async function ensurePlatformSetupDefaults() {
  for (const type of businessTypeCatalog) {
    const existing = await prisma.platformBusinessType.findUnique({
      where: { key: type.key }
    });

    if (!existing) {
      await prisma.platformBusinessType.create({
        data: {
          key: type.key,
          value: type.value,
          label: type.label,
          posMode: type.posMode,
          helper: type.helper,
          defaultTableCount: type.defaultTableCount,
          defaultModuleKeys: type.defaultModuleKeys,
          roles: type.roles,
          active: true
        }
      });
    }
  }

  for (const packageItem of packageCatalog) {
    let existingPackage = await prisma.platformPackage.findUnique({
      where: { key: packageItem.key }
    });

    if (!existingPackage) {
      existingPackage = await prisma.platformPackage.create({
        data: {
          key: packageItem.key,
          name: packageItem.name,
          description: packageItem.description,
          price: packageItem.price,
          currency: packageItem.currency,
          billingCycle: packageItem.billingCycle,
          maxBranches: packageItem.maxBranches,
          maxUsers: packageItem.maxUsers,
          maxProducts: packageItem.maxProducts,
          active: true
        }
      });
    }

    for (const moduleItem of moduleCatalog) {
      await prisma.platformPackageModule.upsert({
        where: {
          packageId_moduleKey: {
            packageId: existingPackage.id,
            moduleKey: moduleItem.key
          }
        },
        update: {},
        create: {
          packageId: existingPackage.id,
          moduleKey: moduleItem.key,
          active: packageItem.defaultModuleKeys.includes(moduleItem.key)
        }
      });
    }
  }

  const [businessTypes, packages, existingBusinesses] = await Promise.all([
    prisma.platformBusinessType.findMany({ where: { active: true } }),
    prisma.platformPackage.findMany({
      where: { active: true },
      include: { modules: true }
    }),
    prisma.business.findMany({
      where: {
        OR: [{ platformBusinessTypeId: null }, { platformPackageId: null }]
      },
      include: {
        modules: true
      }
    })
  ]);

  const normalizedPackages = packages.map(normalizePackage);

  for (const business of existingBusinesses) {
    const matchingType = findMatchingBusinessType(business.type || "", businessTypes);
    const activeModuleKeys = (business.modules || []).filter((moduleItem) => moduleItem.active).map((moduleItem) => moduleItem.key);
    const matchingPackage = pickPackageForBusiness(activeModuleKeys, normalizedPackages);

    await prisma.business.update({
      where: { id: business.id },
      data: {
        platformBusinessTypeId: business.platformBusinessTypeId || matchingType?.id,
        platformPackageId: business.platformPackageId || matchingPackage?.id
      }
    });
  }
}

export async function getPlatformSetupConfig() {
  await ensurePlatformSetupDefaults();

  const [businessTypes, packages] = await Promise.all([
    prisma.platformBusinessType.findMany({
      where: { active: true },
      orderBy: { label: "asc" }
    }),
    prisma.platformPackage.findMany({
      include: {
        modules: {
          orderBy: { moduleKey: "asc" }
        }
      },
      orderBy: { createdAt: "asc" }
    })
  ]);

  return {
    businessTypes: businessTypes.map(normalizeBusinessType),
    modules: moduleCatalog,
    packages: packages.map(normalizePackage)
  };
}

export async function findPlatformBusinessType(type = "") {
  await ensurePlatformSetupDefaults();
  const normalizedType = type.toLowerCase();
  const businessTypes = await prisma.platformBusinessType.findMany({
    where: { active: true }
  });

  return findMatchingBusinessType(type, businessTypes);
}

export async function findPlatformPackage(packageKeyOrId = "STARTER") {
  await ensurePlatformSetupDefaults();
  const lookupValue = packageKeyOrId || "STARTER";

  const platformPackage =
    (await prisma.platformPackage.findFirst({
      where: {
        OR: [{ key: lookupValue }, { id: lookupValue }]
      },
      include: { modules: true }
    })) ||
    (await prisma.platformPackage.findUnique({
      where: { key: "STARTER" },
      include: { modules: true }
    }));

  return platformPackage ? normalizePackage(platformPackage) : null;
}

export function getModuleSetupForPackage(platformPackage) {
  const activeKeys = new Set(platformPackage?.defaultModuleKeys || ["POS"]);

  return moduleCatalog.map((moduleItem) => ({
    key: moduleItem.key,
    active: activeKeys.has(moduleItem.key)
  }));
}

export function getRolesForBusinessType(platformBusinessType) {
  return [...baseBusinessRoles, ...parseJsonArray(platformBusinessType?.roles)];
}
