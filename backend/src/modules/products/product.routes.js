import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";

export const productRouter = Router();

productRouter.use(requireAuth);

async function getBusinessMembership(userId, businessId) {
  return prisma.businessUser.findUnique({
    where: {
      userId_businessId: {
        userId,
        businessId
      }
    },
    include: { role: true }
  });
}

function normalizeOptionalCode(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePrice(value) {
  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    throw new HttpError(400, "Product price must be a valid number.");
  }

  return price.toFixed(2);
}

function normalizeProductType(value) {
  const type = value || "PHYSICAL";

  if (!["PHYSICAL", "SERVICE", "FEE"].includes(type)) {
    throw new HttpError(400, "Product type must be PHYSICAL, SERVICE, or FEE.");
  }

  return type;
}

productRouter.get("/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { category, q = "", status, type } = req.query;
    const membership = await getBusinessMembership(req.user.id, businessId);

    if (!membership && req.user.systemRole !== "SYSTEM_ADMIN") {
      throw new HttpError(403, "You do not have access to this business catalog.");
    }

    if (status && !["ACTIVE", "INACTIVE"].includes(status)) {
      throw new HttpError(400, "Product status must be ACTIVE or INACTIVE.");
    }

    const search = q.trim();
    const products = await prisma.product.findMany({
      where: {
        businessId,
        ...(status ? { status } : {}),
        ...(type ? { type: normalizeProductType(type) } : {}),
        ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
                { barcode: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
                { unit: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ status: "asc" }, { name: "asc" }]
    });

    res.json({ products });
  } catch (error) {
    next(error);
  }
});

productRouter.post("/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { barcode, category, name, price, sku, type, unit } = req.body;

    if (!name || price === undefined || price === null || price === "") {
      throw new HttpError(400, "Product name and price are required.");
    }

    const membership = await getBusinessMembership(req.user.id, businessId);
    const canManageProducts = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager"].includes(membership?.role?.name);

    if (!canManageProducts) {
      throw new HttpError(403, "Only the business owner or manager can create products.");
    }

    const product = await prisma.product.create({
      data: {
        businessId,
        name: name.trim(),
        sku: normalizeOptionalCode(sku),
        barcode: normalizeOptionalCode(barcode),
        type: normalizeProductType(type),
        category: normalizeOptionalCode(category),
        unit: normalizeOptionalCode(unit),
        price: normalizePrice(price)
      }
    });

    res.status(201).json({ product });
  } catch (error) {
    if (error.code === "P2002") {
      next(new HttpError(409, "Product SKU or barcode already exists for this business."));
      return;
    }

    next(error);
  }
});

productRouter.patch("/business/:businessId/:productId", async (req, res, next) => {
  try {
    const { businessId, productId } = req.params;
    const { barcode, category, name, price, sku, type, unit } = req.body;

    if (!name || price === undefined || price === null || price === "") {
      throw new HttpError(400, "Product name and price are required.");
    }

    const membership = await getBusinessMembership(req.user.id, businessId);
    const canManageProducts = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager"].includes(membership?.role?.name);

    if (!canManageProducts) {
      throw new HttpError(403, "Only the business owner or manager can update products.");
    }

    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId
      }
    });

    if (!existingProduct) {
      throw new HttpError(404, "Product was not found.");
    }

    const product = await prisma.product.update({
      where: { id: existingProduct.id },
      data: {
        name: name.trim(),
        sku: normalizeOptionalCode(sku),
        barcode: normalizeOptionalCode(barcode),
        type: normalizeProductType(type),
        category: normalizeOptionalCode(category),
        unit: normalizeOptionalCode(unit),
        price: normalizePrice(price)
      }
    });

    res.json({ product });
  } catch (error) {
    if (error.code === "P2002") {
      next(new HttpError(409, "Product SKU or barcode already exists for this business."));
      return;
    }

    next(error);
  }
});

productRouter.patch("/business/:businessId/:productId/status", async (req, res, next) => {
  try {
    const { businessId, productId } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      throw new HttpError(400, "Product status must be ACTIVE or INACTIVE.");
    }

    const membership = await getBusinessMembership(req.user.id, businessId);
    const canManageProducts = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager"].includes(membership?.role?.name);

    if (!canManageProducts) {
      throw new HttpError(403, "Only the business owner or manager can update products.");
    }

    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId
      }
    });

    if (!existingProduct) {
      throw new HttpError(404, "Product was not found.");
    }

    const product = await prisma.product.update({
      where: { id: existingProduct.id },
      data: { status }
    });

    res.json({ product });
  } catch (error) {
    next(error);
  }
});
