import { stockMutation } from "../../utils/stockRetry.js";
import { ensureInventoryStock } from "../../utils/inventoryStock.js";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";
import { getBusinessAccess } from "../../utils/businessAccess.js";
import { enqueueSyncOperation } from "../../utils/syncQueue.js";

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

const inventoryRoles = new Set(["Owner", "Manager", "Store Keeper", "Pharmacist"]);

function normalizePositiveInteger(value, fieldName) {
  const parsed = Number(value);

  if (!["string", "number"].includes(typeof value) || String(value).trim() === "" || !Number.isInteger(parsed) || parsed < 0 || parsed > 2147483647) {
    throw new HttpError(400, `${fieldName} must be a whole number of 0 or more.`);
  }

  return parsed;
}

async function assertInventoryWorkspace(user, businessId, branchId, { write = false } = {}) {
  const access = await getBusinessAccess(user, businessId);
  const inventoryAllowed = user.systemRole === "SYSTEM_ADMIN" || inventoryRoles.has(access.roleName);

  if (!inventoryAllowed) {
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

  if (write && branch.status !== "ACTIVE") throw new HttpError(409, "Stock cannot be changed in an inactive branch.");

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

    const { roleName } = await assertInventoryWorkspace(req.user, businessId, branchId);
    const owner = roleName === "Owner";
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
        include: { product: owner ? { include: { privateCost: true } } : true, branch: true },
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

    const valuation = owner ? stockItems.reduce((result, stock) => {
      const cost = stock.product.privateCost?.amount;
      if (Number(stock.quantity) > 0 && cost == null) result.missingCostProducts += 1;
      if (cost != null) result.value += Number(stock.quantity) * Number(cost);
      return result;
    }, { value: 0, missingCostProducts: 0, basis: "CURRENT_COST" }) : null;
    if (valuation) valuation.value = Math.round(valuation.value * 100) / 100;
    res.json({ stockItems: stockItems.map(stock => {
      const { privateCost, ...product } = stock.product;
      return { ...stock, product };
    }), recentAdjustments, valuation });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.patch("/business/:businessId/branch/:branchId/products/:productId/stock", async (req, res, next) => {
  try {
    const { businessId, branchId, productId } = req.params;
    const { note = "", quantity, reorderLevel = 0 } = req.body;
    validateStockNote(note);

    await assertInventoryWorkspace(req.user, businessId, branchId, { write: true });

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

    const updatedStock = await stockMutation(prisma, req, async (tx) => {
      const currentStock = await ensureInventoryStock(tx, { businessId, branchId, productId });

      const [lockedStock] = await tx.$queryRaw`SELECT "quantity" FROM "InventoryStock" WHERE "id" = ${currentStock.id} FOR UPDATE`;
      currentStock.quantity = lockedStock.quantity;
      if(req.body.expectedQuantity !== undefined && normalizePositiveInteger(req.body.expectedQuantity,'Expected quantity') !== currentStock.quantity) throw new HttpError(409,'Stock changed since this count was opened. Reload inventory and review the count.');
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

    if (!req.stockReplayed) await enqueueSyncOperation({
      businessId,
      branchId,
      entityType: "inventory_stock",
      entityId: updatedStock.id,
      operation: "set",
      method: "PATCH",
      endpoint: `/api/inventory/business/${businessId}/branch/${branchId}/products/${productId}/stock`,
      payload: {
        ...(req.body.requestKey ? {requestKey:req.body.requestKey} : {}),
        productId,
        quantity: nextQuantity,
        reorderLevel: nextReorderLevel,
        note
      },
      userId: req.user.id
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
    validateStockNote(note);

    await assertInventoryWorkspace(req.user, businessId, branchId, { write: true });

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

    const updatedStock = await stockMutation(prisma, req, async (tx) => {
      const currentStock = await ensureInventoryStock(tx, { businessId, branchId, productId });

      const stock = await tx.inventoryStock.update({
        where: { id: currentStock.id },
        data: {
          quantity: { increment: receivedQuantity }
        },
        include: stockInclude()
      });
      const nextQuantity = stock.quantity;

      await tx.stockAdjustment.create({
        data: {
          type: "INCREASE",
          quantityBefore: nextQuantity - receivedQuantity,
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

    if (!req.stockReplayed) await enqueueSyncOperation({
      businessId,
      branchId,
      entityType: "inventory_stock",
      entityId: updatedStock.id,
      operation: "receive",
      method: "POST",
      endpoint: `/api/inventory/business/${businessId}/branch/${branchId}/products/${productId}/receive`,
      payload: {
        ...(req.body.requestKey ? {requestKey:req.body.requestKey} : {}),
        productId,
        quantity: receivedQuantity,
        note
      },
      userId: req.user.id
    });

    res.json({ stock: updatedStock });
  } catch (error) {
    next(error);
  }
});

inventoryRouter.post("/business/:businessId/transfer", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { fromBranchId, note = "", productId, quantity, toBranchId } = req.body;
    validateStockNote(note);

    if ([fromBranchId, toBranchId, productId].some(value => typeof value !== "string" || !value)) {
      throw new HttpError(400, "Product, source branch, and receiving branch are required.");
    }

    if (fromBranchId === toBranchId) {
      throw new HttpError(400, "Choose a different branch to receive the stock.");
    }

    await Promise.all([
      assertInventoryWorkspace(req.user, businessId, fromBranchId, { write: true }),
      assertInventoryWorkspace(req.user, businessId, toBranchId, { write: true })
    ]);

    const transferQuantity = normalizePositiveInteger(quantity, "Transfer quantity");

    if (transferQuantity <= 0) {
      throw new HttpError(400, "Transfer quantity must be at least 1.");
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

    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.findFirst({ where: { id: fromBranchId, businessId } }),
      prisma.branch.findFirst({ where: { id: toBranchId, businessId } })
    ]);

    const result = await stockMutation(prisma, req, async (tx) => {
      // Use the same locking order for transfers in either direction.
      for (const branchId of [fromBranchId, toBranchId].sort()) {
        await tx.inventoryStock.createMany({
          data: [{ businessId, branchId, productId, quantity: 0, reorderLevel: 0 }],
          skipDuplicates: true
        });
      }
      const locked = await tx.$queryRaw`
        SELECT "id", "branchId", "quantity" FROM "InventoryStock"
        WHERE "productId" = ${productId} AND "branchId" IN (${fromBranchId}, ${toBranchId})
        ORDER BY "branchId" FOR UPDATE
      `;
      const fromStock = locked.find(row => row.branchId === fromBranchId);
      const toStock = locked.find(row => row.branchId === toBranchId);
      if (toStock.quantity > 2147483647 - transferQuantity) throw new HttpError(400, "Destination stock exceeds the supported quantity.");

      if (fromStock.quantity < transferQuantity) {
        throw new HttpError(400, `Only ${fromStock.quantity} ${product.name} available in ${fromBranch?.name || "the source branch"}.`);
      }

      const sourceNextQuantity = fromStock.quantity - transferQuantity;
      const destinationNextQuantity = toStock.quantity + transferQuantity;
      const cleanNote = note.trim();

      const sourceStock = await tx.inventoryStock.update({
        where: { id: fromStock.id },
        data: { quantity: sourceNextQuantity },
        include: stockInclude()
      });
      const destinationStock = await tx.inventoryStock.update({
        where: { id: toStock.id },
        data: { quantity: destinationNextQuantity },
        include: stockInclude()
      });

      await tx.stockAdjustment.create({
        data: {
          type: "DECREASE",
          quantityBefore: fromStock.quantity,
          quantityChange: -transferQuantity,
          quantityAfter: sourceNextQuantity,
          note: `Transfer to ${toBranch?.name || "branch"}${cleanNote ? ` - ${cleanNote}` : ""}`,
          businessId,
          branchId: fromBranchId,
          productId,
          userId: req.user.id
        }
      });
      await tx.stockAdjustment.create({
        data: {
          type: "INCREASE",
          quantityBefore: toStock.quantity,
          quantityChange: transferQuantity,
          quantityAfter: destinationNextQuantity,
          note: `Transfer from ${fromBranch?.name || "branch"}${cleanNote ? ` - ${cleanNote}` : ""}`,
          businessId,
          branchId: toBranchId,
          productId,
          userId: req.user.id
        }
      });

      return { sourceStock, destinationStock };
    });

    if (!req.stockReplayed) await enqueueSyncOperation({
      businessId,
      branchId: fromBranchId,
      entityType: "inventory_transfer",
      entityId: productId,
      operation: "transfer",
      method: "POST",
      endpoint: `/api/inventory/business/${businessId}/transfer`,
      payload: {
        ...(req.body.requestKey ? {requestKey:req.body.requestKey} : {}),
        fromBranchId,
        toBranchId,
        productId,
        quantity: transferQuantity,
        note
      },
      userId: req.user.id
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

function validateStockNote(note) {
  if (typeof note !== "string" || note.length > 2000) throw new HttpError(400, "Stock note must be text of at most 2000 characters.");
}
