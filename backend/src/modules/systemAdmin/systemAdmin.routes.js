import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireSystemAdmin } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";
import { getMissingPlatformModules, moduleCatalog, normalizePOSMode } from "../../config/platformCatalog.js";
import {
  findPlatformBusinessType,
  findPlatformPackage,
  getModuleSetupForPackage,
  getPlatformSetupConfig,
  getRolesForBusinessType
} from "../../utils/platformSetup.js";
import { assertBusinessFitsPackage } from "../../utils/packageLimits.js";

export const systemAdminRouter = Router();

systemAdminRouter.use(requireAuth, requireSystemAdmin);

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

systemAdminRouter.get("/setup-catalog", async (_req, res, next) => {
  try {
    res.json(await getPlatformSetupConfig());
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

    const requestedModuleKeys = Array.isArray(defaultModuleKeys) ? defaultModuleKeys.map((key) => String(key).toUpperCase()) : [];
    const knownModuleKeys = new Set(moduleCatalog.map((moduleItem) => moduleItem.key));
    const selectedModuleKeys = [...new Set(requestedModuleKeys)].filter((key) => knownModuleKeys.has(key));

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

    res.status(201).json({ business: createdBusiness });
  } catch (error) {
    next(error);
  }
});
systemAdminRouter.patch("/businesses/:businessId/system-settings", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { name, type, country, currency, packageKey, packageId, platformPackageId, packageStatus, status } = req.body;

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
          platformBusinessTypeId: platformBusinessType.id,
          platformPackageId: platformPackage.id,
          packageStatus: packageStatus || existingBusiness.packageStatus || "ACTIVE",
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

    res.json({ business: updatedBusiness });
  } catch (error) {
    next(error);
  }
});
