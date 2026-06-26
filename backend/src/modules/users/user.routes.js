import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";
import { getDefaultStaffRoleName, getMissingDefaultRoles } from "../../utils/businessRoles.js";

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get("/me", (req, res) => {
  res.json({ user: req.user });
});

userRouter.get("/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;

    const membership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: req.user.id,
          businessId
        }
      }
    });

    if (!membership && req.user.systemRole !== "SYSTEM_ADMIN") {
      throw new HttpError(403, "You do not have access to this business.");
    }

    const users = await prisma.businessUser.findMany({
      where: { businessId },
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
      },
      orderBy: { createdAt: "asc" }
    });

    res.json({ users });
  } catch (error) {
    next(error);
  }
});

userRouter.post("/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { name, email, password, roleName } = req.body;

    if (!name || !email || !password) {
      throw new HttpError(400, "Name, email, and password are required.");
    }

    if (password.length < 8) {
      throw new HttpError(400, "Password must be at least 8 characters.");
    }

    const requesterMembership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: req.user.id,
          businessId
        }
      },
      include: { role: true }
    });

    const canManageUsers = req.user.systemRole === "SYSTEM_ADMIN" || requesterMembership?.role?.name === "Owner";

    if (!canManageUsers) {
      throw new HttpError(403, "Only the business owner can create users for this business.");
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      throw new HttpError(409, "A user with this email already exists.");
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { roles: true }
    });

    if (!business) {
      throw new HttpError(404, "Business was not found.");
    }

    const missingRoles = getMissingDefaultRoles(business.roles, business.type, business.posMode);

    if (missingRoles.length > 0) {
      await prisma.role.createMany({
        data: missingRoles.map((missingRole) => ({
          ...missingRole,
          businessId
        })),
        skipDuplicates: true
      });
    }

    const selectedRoleName = roleName || getDefaultStaffRoleName(business);
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
        business: {
          connect: { id: businessId }
        },
        role: {
          connect: { id: role.id }
        },
        user: {
          create: {
            name,
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

    res.status(201).json({ businessUser });
  } catch (error) {
    next(error);
  }
});

userRouter.patch("/business/:businessId/:membershipId/status", async (req, res, next) => {
  try {
    const { businessId, membershipId } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      throw new HttpError(400, "User status must be ACTIVE or INACTIVE.");
    }

    const requesterMembership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: req.user.id,
          businessId
        }
      },
      include: { role: true }
    });

    const canManageUsers = req.user.systemRole === "SYSTEM_ADMIN" || requesterMembership?.role?.name === "Owner";

    if (!canManageUsers) {
      throw new HttpError(403, "Only the business owner can update users for this business.");
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

    if (targetMembership.userId === req.user.id) {
      throw new HttpError(400, "You cannot deactivate your own account.");
    }

    if (targetMembership.role?.name === "Owner" && status === "INACTIVE") {
      throw new HttpError(400, "The business owner account cannot be deactivated here.");
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
