import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

const inventoryRoles = new Set(["Owner", "Manager", "Store Keeper", "Pharmacist"]);

async function getInventoryAccess(user, businessId) {
  if (user.systemRole === "SYSTEM_ADMIN") {
    return { allowed: true, roleName: "System Admin" };
  }

  const membership = await prisma.businessUser.findUnique({
    where: {
      userId_businessId: {
        userId: user.id,
        businessId
      }
    },
    include: { role: true }
  });

  const roleName = membership?.role?.name || "";
  return { allowed: inventoryRoles.has(roleName), roleName };
}

function normalizePositiveInteger(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new HttpError(400, `${fieldName} must be a whole number of 0 or more.`);
  }

  return parsed;
}

async function assertInventoryWorkspace(user, businessId, branchId) {
  const access = await getInventoryAccess(user, businessId);

  if (!access.allowed) {
    throw new HttpError(403, "You do not have inventory access for this business.");
  }

  const [branch, inventoryModule] = await Promise.all([
    prisma.branch.findFirst({
      where: {
        id: branchId,
        businessId
      }
    }),
    prisma.businessModule.findUnique({
      where: {
        businessId_key: {
          businessId,
          key: "INVENTORY"
        }
      }
    })
  ]);

  if (!branch) {
    throw new HttpError(404, "Branch was not found for this business.");
  }

  if (user.systemRole !== "SYSTEM_ADMIN" && !inventoryModule?.active) {
    throw new HttpError(403, "Inventory module is not active for this business.");
  }

  return { branch, roleName: access.roleName };
}

async function ensureStockRows(businessId, branchId) {
  const products = await prisma.product.findMany({
    where: {
      businessId,
      type: "PHYSICAL"
    },
    select: { id: true }
  });

  if (products.length === 0) {
    return;
  }

  await prisma.inventoryStock.createMany({
    data: products.map((product) => ({
      businessId,
      branchId,
      productId: product.id
    })),
    skipDuplicates: true
  });
}

function stockInclude() {
  return {
    product: true,
    branch: true
  };
}

inventoryRouter.get("/business/:businessId/branch/:branchId", async (req, res, next) => {
  try {
    const { businessId, branchId } = req.params;

    await assertInventoryWorkspace(req.user, businessId, branchId);
    await ensureStockRows(businessId, branchId);

    const [stockItems, recentAdjustments] = await Promise.all([
      prisma.inventoryStock.findMany({
        where: {
          businessId,
          branchId,
          product: {
            type: "PHYSICAL"
          }
        },
        include: stockInclude(),
        orderBy: [{ product: { name: "asc" } }]
      }),
      prisma.stockAdjustment.findMany({
        where: {
          businessId,
          branchId
        },
        include: {
          product: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 80
      })
    ]);

    res.json({ stockItems, recentAdjustments });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.patch("/business/:businessId/branch/:branchId/products/:productId/stock", async (req, res, next) => {
  try {
    const { businessId, branchId, productId } = req.params;
    const { note = "", quantity, reorderLevel = 0 } = req.body;

    await assertInventoryWorkspace(req.user, businessId, branchId);

    const nextQuantity = normalizePositiveInteger(quantity, "Stock quantity");
    const nextReorderLevel = normalizePositiveInteger(reorderLevel, "Low stock alert");

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
        type: "PHYSICAL"
      }
    });

    if (!product) {
      throw new HttpError(404, "Physical product was not found for this business.");
    }

    const updatedStock = await prisma.$transaction(async (tx) => {
      const currentStock = await tx.inventoryStock.upsert({
        where: {
          productId_branchId: {
            productId,
            branchId
          }
        },
        create: {
          businessId,
          branchId,
          productId,
          quantity: 0,
          reorderLevel: 0
        },
        update: {}
      });

      const quantityChange = nextQuantity - currentStock.quantity;

      const stock = await tx.inventoryStock.update({
        where: { id: currentStock.id },
        data: {
          quantity: nextQuantity,
          reorderLevel: nextReorderLevel
        },
        include: stockInclude()
      });

      if (quantityChange !== 0 || note.trim()) {
        await tx.stockAdjustment.create({
          data: {
            type: "SET",
            quantityBefore: currentStock.quantity,
            quantityChange,
            quantityAfter: nextQuantity,
            note: note.trim() || null,
            businessId,
            branchId,
            productId,
            userId: req.user.id
          }
        });
      }

      return stock;
    });

    res.json({ stock: updatedStock });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.post("/business/:businessId/branch/:branchId/products/:productId/receive", async (req, res, next) => {
  try {
    const { businessId, branchId, productId } = req.params;
    const { note = "", quantity } = req.body;

    await assertInventoryWorkspace(req.user, businessId, branchId);

    const receivedQuantity = normalizePositiveInteger(quantity, "Received quantity");

    if (receivedQuantity <= 0) {
      throw new HttpError(400, "Received quantity must be at least 1.");
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
        type: "PHYSICAL"
      }
    });

    if (!product) {
      throw new HttpError(404, "Physical product was not found for this business.");
    }

    const updatedStock = await prisma.$transaction(async (tx) => {
      const currentStock = await tx.inventoryStock.upsert({
        where: {
          productId_branchId: {
            productId,
            branchId
          }
        },
        create: {
          businessId,
          branchId,
          productId,
          quantity: 0,
          reorderLevel: 0
        },
        update: {}
      });

      const nextQuantity = currentStock.quantity + receivedQuantity;

      const stock = await tx.inventoryStock.update({
        where: { id: currentStock.id },
        data: {
          quantity: nextQuantity
        },
        include: stockInclude()
      });

      await tx.stockAdjustment.create({
        data: {
          type: "INCREASE",
          quantityBefore: currentStock.quantity,
          quantityChange: receivedQuantity,
          quantityAfter: nextQuantity,
          note: note.trim() || "Received stock",
          businessId,
          branchId,
          productId,
          userId: req.user.id
        }
      });

      return stock;
    });

    res.json({ stock: updatedStock });
  } catch (error) {
    next(error);
  }
});
