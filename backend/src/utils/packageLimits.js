import { prisma } from "../config/prisma.js";
import { HttpError } from "./httpError.js";

const limitLabels = {
  maxBranches: "active branches",
  maxUsers: "active users",
  maxProducts: "active products"
};

async function getBusinessPackage(businessId) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      platformPackage: true
    }
  });

  if (!business) {
    throw new HttpError(404, "Business was not found.");
  }

  if (business.platformPackage) {
    return { business, platformPackage: business.platformPackage };
  }

  const starterPackage = await prisma.platformPackage.findUnique({
    where: { key: "STARTER" }
  });

  return { business, platformPackage: starterPackage };
}

export async function getPackageLimitSnapshot(businessId, platformPackage = null) {
  const packageContext = platformPackage ? { platformPackage } : await getBusinessPackage(businessId);
  const selectedPackage = packageContext.platformPackage;
  const [activeBranches, activeUsers, activeProducts] = await Promise.all([
    prisma.branch.count({
      where: {
        businessId,
        status: "ACTIVE"
      }
    }),
    prisma.businessUser.count({
      where: {
        businessId,
        user: {
          status: "ACTIVE"
        }
      }
    }),
    prisma.product.count({
      where: {
        businessId,
        status: "ACTIVE"
      }
    })
  ]);

  return {
    package: selectedPackage,
    usage: {
      branches: activeBranches,
      users: activeUsers,
      products: activeProducts
    },
    limits: {
      maxBranches: selectedPackage?.maxBranches ?? null,
      maxUsers: selectedPackage?.maxUsers ?? null,
      maxProducts: selectedPackage?.maxProducts ?? null
    }
  };
}

export function assertPackageLimit(snapshot, limitKey, nextValue) {
  const limit = snapshot.limits[limitKey];

  if (limit === null || limit === undefined || nextValue <= limit) {
    return;
  }

  const packageName = snapshot.package?.name || "current";
  throw new HttpError(403, `The ${packageName} package allows ${limit} ${limitLabels[limitKey]}. Upgrade the package or deactivate unused records first.`);
}

export async function assertCanCreateBranch(businessId) {
  const snapshot = await getPackageLimitSnapshot(businessId);
  assertPackageLimit(snapshot, "maxBranches", snapshot.usage.branches + 1);
}

export async function assertCanCreateBusinessUser(businessId) {
  const snapshot = await getPackageLimitSnapshot(businessId);
  assertPackageLimit(snapshot, "maxUsers", snapshot.usage.users + 1);
}

export async function assertCanCreateProduct(businessId) {
  const snapshot = await getPackageLimitSnapshot(businessId);
  assertPackageLimit(snapshot, "maxProducts", snapshot.usage.products + 1);
}

export async function assertBusinessFitsPackage(businessId, platformPackage) {
  const snapshot = await getPackageLimitSnapshot(businessId, platformPackage);

  assertPackageLimit(snapshot, "maxBranches", snapshot.usage.branches);
  assertPackageLimit(snapshot, "maxUsers", snapshot.usage.users);
  assertPackageLimit(snapshot, "maxProducts", snapshot.usage.products);

  return snapshot;
}
