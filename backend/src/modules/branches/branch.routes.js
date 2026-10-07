import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";
import { assertCanCreateBranch } from "../../utils/packageLimits.js";
import { normalizePOSMode } from "../../config/platformCatalog.js";
import { getBusinessAccess, getOperationalBusinessWhereForUser } from "../../utils/businessAccess.js";
import { enqueueSyncOperation } from "../../utils/syncQueue.js";

export const branchRouter = Router();

branchRouter.use(requireAuth);

branchRouter.post("/", async (req, res, next) => {
  try {
    const { businessId, name, location } = req.body;

    if (!businessId || !name) {
      throw new HttpError(400, "Business and branch name are required.");
    }

    const { membership } = await getBusinessAccess(req.user, businessId);

    const canManageBranches = req.user.systemRole === "SYSTEM_ADMIN" || membership?.role?.name === "Owner";

    if (!canManageBranches) {
      throw new HttpError(403, "Only the business owner can create branches for this business.");
    }

    await assertCanCreateBranch(businessId);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { platformBusinessType: true }
    });

    if (!business) {
      throw new HttpError(404, "Business was not found.");
    }

    const branch = await prisma.$transaction(async (tx) => {
      const createdBranch = await tx.branch.create({
        data: {
          businessId,
          name,
          location
        }
      });

      const posMode = normalizePOSMode(business.posMode, business.type);

      if (posMode === "TABLE_SERVICE") {
        await tx.pOSTable.createMany({
          data: Array.from({ length: business.platformBusinessType?.defaultTableCount || 8 }, (_, index) => ({
            businessId,
            branchId: createdBranch.id,
            name: `Table ${index + 1}`,
            seats: 4
          }))
        });
      }

      return createdBranch;
    });

    await enqueueSyncOperation({
      businessId,
      branchId: branch.id,
      entityType: "branch",
      entityId: branch.id,
      operation: "create",
      method: "POST",
      endpoint: "/api/branches",
      payload: {
        localId: branch.id,
        businessId,
        name,
        location
      },
      userId: req.user.id
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
          ...getOperationalBusinessWhereForUser(req.user.id)
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

    const { membership } = await getBusinessAccess(req.user, businessId);

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

    if (status === "ACTIVE" && existingBranch.status !== "ACTIVE") {
      await assertCanCreateBranch(businessId);
    }

    const branch = await prisma.branch.update({
      where: { id: existingBranch.id },
      data: { status }
    });

    await enqueueSyncOperation({
      businessId,
      branchId: branch.id,
      entityType: "branch",
      entityId: branch.id,
      operation: "status",
      method: "PATCH",
      endpoint: `/api/branches/${businessId}/${branchId}/status`,
      payload: {
        localId: branch.id,
        status
      },
      userId: req.user.id
    });

    res.json({ branch });
  } catch (error) {
    next(error);
  }
});
