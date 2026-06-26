import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";
import { getMissingDefaultRoles } from "../../utils/businessRoles.js";

export const businessRouter = Router();

businessRouter.use(requireAuth);

businessRouter.post("/", async (req, res, next) => {
  try {
    throw new HttpError(403, "Businesses are created by the Zera system admin.");
  } catch (error) {
    next(error);
  }
});

businessRouter.patch("/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { name, country, currency } = req.body;

    if (!name) {
      throw new HttpError(400, "Business name is required.");
    }

    const membership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: req.user.id,
          businessId
        }
      },
      include: { role: true }
    });

    const canManageBusiness = req.user.systemRole === "SYSTEM_ADMIN" || membership?.role?.name === "Owner";

    if (!canManageBusiness) {
      throw new HttpError(403, "Only the business owner can update this business.");
    }

    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        name,
        country,
        currency: currency || "UGX"
      },
      include: {
        branches: true,
        modules: true,
        roles: true
      }
    });

    res.json({ business });
  } catch (error) {
    next(error);
  }
});

businessRouter.get("/", async (req, res, next) => {
  try {
    let businesses = await prisma.business.findMany({
      where: {
        memberships: {
          some: {
            userId: req.user.id
          }
        }
      },
      include: {
        branches: true,
        modules: true,
        roles: true
      },
      orderBy: { createdAt: "desc" }
    });

    const missingRoleGroups = businesses
      .map((business) => ({
        business,
        roles: getMissingDefaultRoles(business.roles, business.type, business.posMode)
      }))
      .filter((group) => group.roles.length > 0);

    if (missingRoleGroups.length > 0) {
      for (const group of missingRoleGroups) {
        await prisma.role.createMany({
          data: group.roles.map((role) => ({
            ...role,
            businessId: group.business.id
          })),
          skipDuplicates: true
        });
      }

      businesses = await prisma.business.findMany({
        where: {
          memberships: {
            some: {
              userId: req.user.id
            }
          }
        },
        include: {
          branches: true,
          modules: true,
          roles: true
        },
        orderBy: { createdAt: "desc" }
      });
    }

    res.json({ businesses });
  } catch (error) {
    next(error);
  }
});
