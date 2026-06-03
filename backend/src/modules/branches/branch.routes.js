import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";

export const branchRouter = Router();

branchRouter.use(requireAuth);

branchRouter.post("/", async (req, res, next) => {
  try {
    const { businessId, name, location } = req.body;

    if (!businessId || !name) {
      throw new HttpError(400, "Business and branch name are required.");
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

    const canManageBranches = req.user.systemRole === "SYSTEM_ADMIN" || membership?.role?.name === "Owner";

    if (!canManageBranches) {
      throw new HttpError(403, "Only the business owner can create branches for this business.");
    }

    const branch = await prisma.branch.create({
      data: {
        businessId,
        name,
        location
      }
    });

    res.status(201).json({ branch });
  } catch (error) {
    next(error);
  }
});

branchRouter.get("/", async (req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      where: {
        business: {
          memberships: {
            some: {
              userId: req.user.id
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ branches });
  } catch (error) {
    next(error);
  }
});

branchRouter.patch("/:businessId/:branchId/status", async (req, res, next) => {
  try {
    const { businessId, branchId } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      throw new HttpError(400, "Branch status must be ACTIVE or INACTIVE.");
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

    const canManageBranches = req.user.systemRole === "SYSTEM_ADMIN" || membership?.role?.name === "Owner";

    if (!canManageBranches) {
      throw new HttpError(403, "Only the business owner can update branches for this business.");
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

    const branch = await prisma.branch.update({
      where: { id: existingBranch.id },
      data: { status }
    });

    res.json({ branch });
  } catch (error) {
    next(error);
  }
});
