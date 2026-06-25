import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireSystemAdmin } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";

export const systemAdminRouter = Router();

systemAdminRouter.use(requireAuth, requireSystemAdmin);

const defaultModules = [
  { key: "POS", active: true },
  { key: "INVENTORY", active: false },
  { key: "FINANCE", active: false },
  { key: "OPERATIONS", active: false },
  { key: "REPORTS", active: false }
];

function normalizePOSMode(value, businessType = "") {
  if (["RETAIL_CHECKOUT", "TABLE_SERVICE"].includes(value)) {
    return value;
  }

  const normalizedType = businessType.toLowerCase();

  if (normalizedType.includes("bar") || normalizedType.includes("restaurant")) {
    return "TABLE_SERVICE";
  }

  return "RETAIL_CHECKOUT";
}

systemAdminRouter.get("/businesses", async (_req, res, next) => {
  try {
    const businesses = await prisma.business.findMany({
      include: {
        branches: true,
        modules: true,
        _count: {
          select: {
            products: true
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
      },
      orderBy: { createdAt: "desc" }
    });

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

    const posMode = normalizePOSMode(business.posMode, business.type);

    const createdBusiness = await prisma.$transaction(async (tx) => {
      const newBusiness = await tx.business.create({
        data: {
          name: business.name,
          type: business.type,
          posMode,
          country: business.country || "Uganda",
          currency: business.currency || "UGX",
          roles: {
            create: [
              { name: "Owner", description: "Full access to the business." },
              { name: "Manager", description: "Manage daily operations." },
              { name: "Cashier", description: "Serve customers and run POS." }
            ]
          },
          modules: {
            create: defaultModules
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
          data: Array.from({ length: 8 }, (_, index) => ({
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
        include: {
          branches: true,
          modules: true,
          _count: {
            select: {
              products: true
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
        }
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
    const { name, type, posMode, country, currency, status } = req.body;

    const existingBusiness = await prisma.business.findUnique({
      where: { id: businessId }
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

    const nextType = type?.trim() || existingBusiness.type;
    const nextPOSMode = normalizePOSMode(posMode, nextType);

    const updatedBusiness = await prisma.$transaction(async (tx) => {
      await tx.business.update({
        where: { id: businessId },
        data: {
          name: name.trim(),
          type: nextType,
          posMode: nextPOSMode,
          country: country?.trim() || existingBusiness.country || "Uganda",
          currency: currency?.trim().toUpperCase() || existingBusiness.currency,
          status: status || existingBusiness.status
        }
      });

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
              data: Array.from({ length: 8 }, (_, index) => ({
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
        include: {
          branches: true,
          modules: true,
          _count: {
            select: {
              products: true
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
        }
      });
    });

    res.json({ business: updatedBusiness });
  } catch (error) {
    next(error);
  }
});
