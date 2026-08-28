import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";
import { moduleCatalog } from "../../config/platformCatalog.js";

export const moduleRouter = Router();

moduleRouter.use(requireAuth);

moduleRouter.get("/", (_req, res) => {
  res.json({
    modules: moduleCatalog
  });
});

moduleRouter.patch("/:businessId/:key", async (req, res, next) => {
  try {
    const { businessId, key } = req.params;
    const { active } = req.body;
    const normalizedKey = key.toUpperCase();

    if (typeof active !== "boolean") {
      throw new HttpError(400, "Module active status must be true or false.");
    }

    const knownModule = moduleCatalog.some((moduleItem) => moduleItem.key === normalizedKey);

    if (!knownModule) {
      throw new HttpError(400, "Unknown module.");
    }

    if (req.user.systemRole !== "SYSTEM_ADMIN") {
      throw new HttpError(403, "Only the Zera system admin can update modules for this business.");
    }

    const module = await prisma.businessModule.update({
      where: {
        businessId_key: {
          businessId,
          key: normalizedKey
        }
      },
      data: { active }
    });

    res.json({ module });
  } catch (error) {
    next(error);
  }
});
