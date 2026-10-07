import { withBusinessFeatures } from "../config/businessFeatures.js";
import { prisma } from "../config/prisma.js";
import { HttpError } from "./httpError.js";

const blockedPackageStatuses = new Set(["SUSPENDED", "CANCELLED"]);

export function assertBusinessOperational(business) {
  if (!business) {
    throw new HttpError(404, "Business was not found.");
  }

  if (business.status !== "ACTIVE") {
    throw new HttpError(403, "This business is inactive. Contact Zera support to restore access.");
  }

  if (blockedPackageStatuses.has(business.packageStatus)) {
    throw new HttpError(403, `This business package is ${business.packageStatus.toLowerCase()}. Contact Zera support to restore access.`);
  }
}

export async function getBusinessAccess(user, businessId, { requireOperational = true } = {}) {
  const membership =
    user.systemRole === "SYSTEM_ADMIN"
      ? null
      : await prisma.businessUser.findUnique({
          where: {
            userId_businessId: {
              userId: user.id,
              businessId
            }
          },
          include: { role: true }
        });

  if (!membership && user.systemRole !== "SYSTEM_ADMIN") {
    throw new HttpError(403, "You do not have access to this business.");
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId }, include: {modules:true,platformBusinessType:true}
  });

  if (!business) {
    throw new HttpError(404, "Business was not found.");
  }

  if (requireOperational && user.systemRole !== "SYSTEM_ADMIN") {
    assertBusinessOperational(business);
  }

  return {
    business: withBusinessFeatures(business),
    membership,
    roleName: membership?.role?.name || user.systemRole
  };
}

export function getOperationalBusinessWhereForUser(userId) {
  return {
    status: "ACTIVE",
    packageStatus: {
      notIn: [...blockedPackageStatuses]
    },
    memberships: {
      some: {
        userId
      }
    }
  };
}
