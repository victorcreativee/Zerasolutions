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

    const createdBusiness = await prisma.$transaction(async (tx) => {
      const newBusiness = await tx.business.create({
        data: {
          name: business.name,
          type: business.type,
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
