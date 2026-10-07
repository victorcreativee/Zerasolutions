import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { getBusinessAccess } from "../../utils/businessAccess.js";
import { HttpError } from "../../utils/httpError.js";
import { getDefaultStaffRoleName, getMissingDefaultRoles } from "../../utils/businessRoles.js";
import { assertCanCreateBusinessUser } from "../../utils/packageLimits.js";
import { enqueueSyncOperation } from "../../utils/syncQueue.js";

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get("/me", (req, res) => {
  res.json({ user: req.user });
});

userRouter.get("/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    await getBusinessAccess(req.user, businessId);

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

    const { membership: requesterMembership } = await getBusinessAccess(req.user, businessId);

    const canManageUsers = req.user.systemRole === "SYSTEM_ADMIN" || requesterMembership?.role?.name === "Owner";

    if (!canManageUsers) {
      throw new HttpError(403, "Only the business owner can create users for this business.");
    }

    await assertCanCreateBusinessUser(businessId);

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

    await enqueueSyncOperation({
      businessId,
      entityType: "business_user",
      entityId: businessUser.id,
      operation: "create",
      method: "POST",
      endpoint: `/api/users/business/${businessId}`,
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

userRouter.patch("/business/:businessId/:membershipId/status", async (req, res, next) => {
  try {
    const { businessId, membershipId } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      throw new HttpError(400, "User status must be ACTIVE or INACTIVE.");
    }

    const { membership: requesterMembership } = await getBusinessAccess(req.user, businessId);

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
      operation: "status",
      method: "PATCH",
      endpoint: `/api/users/business/${businessId}/${membershipId}/status`,
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
