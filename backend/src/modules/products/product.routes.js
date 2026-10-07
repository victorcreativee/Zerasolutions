import {pricingChanges,presentProduct} from '../../utils/productPricing.js';
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { getBusinessAccess } from "../../utils/businessAccess.js";
import { HttpError } from "../../utils/httpError.js";
import { assertCanCreateProduct, assertPackageLimit, getPackageLimitSnapshot } from "../../utils/packageLimits.js";
import { enqueueSyncOperation } from "../../utils/syncQueue.js";

export const productRouter = Router();

productRouter.use(requireAuth);

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
    const {roleName} = await getBusinessAccess(req.user, businessId);
    const owner = roleName === "Owner";

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
      include: owner ? {privateCost:true} : undefined,
      orderBy: [{ status: "asc" }, { name: "asc" }]
    });

    res.json({ products:products.map(product=>presentProduct(product,owner)) });
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

    const { membership } = await getBusinessAccess(req.user, businessId);
    const canManageProducts = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager", "Store Keeper", "Pharmacist"].includes(membership?.role?.name);

    if (!canManageProducts) {
      throw new HttpError(403, "Only the business owner or manager can create products.");
    }

    await assertCanCreateProduct(businessId);

    const product = await prisma.product.create({
      data: {
        businessId,
        name: name.trim(),
        sku: normalizeOptionalCode(sku),
        barcode: normalizeOptionalCode(barcode),
        type: normalizeProductType(type),
        category: normalizeOptionalCode(category),
        unit: normalizeOptionalCode(unit),
        ...pricingChanges(req.body, null, membership?.role?.name === "Owner", req.user.systemRole === "SYSTEM_ADMIN")
      }
    });

    await enqueueSyncOperation({
      businessId,
      entityType: "product",
      entityId: product.id,
      operation: "create",
      method: "POST",
      endpoint: `/api/products/business/${businessId}`,
      payload: {
        localId: product.id,
        minimumPrice: product.minimumPrice,
        barcode,
        category,
        name,
        price,
        sku,
        type,
        unit
      },
      userId: req.user.id
    });

    res.status(201).json({ product:presentProduct(await prisma.product.findUnique({where:{id:product.id},include:membership?.role?.name === "Owner" ? {privateCost:true} : undefined}),membership?.role?.name === "Owner") });
  } catch (error) {
    if (error.code === "P2002") {
      next(new HttpError(409, "Product SKU or barcode already exists for this business."));
      return;
    }

    next(error);
  }
});

productRouter.post("/business/:businessId/import", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { products = [] } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      throw new HttpError(400, "Add at least one product to import.");
    }

    if (products.length > 500) {
      throw new HttpError(400, "Import up to 500 products at a time.");
    }

    const { membership } = await getBusinessAccess(req.user, businessId);
    const canManageProducts = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager", "Store Keeper", "Pharmacist"].includes(membership?.role?.name);

    if (!canManageProducts) {
      throw new HttpError(403, "Only the business owner or manager can import products.");
    }

    const rows = products.map((product, index) => {
      const pricing = pricingChanges(product,null,membership?.role?.name === "Owner",req.user.systemRole === "SYSTEM_ADMIN");
      if ("costPrice" in product) throw new HttpError(400,"Add private cost prices in the product editor after import.");
      return {...normalizeImportProduct(product,index),minimumPrice:pricing.minimumPrice};
    });
    const snapshot = await getPackageLimitSnapshot(businessId);
    assertPackageLimit(snapshot, "maxProducts", snapshot.usage.products + rows.length);

    const result = await prisma.product.createMany({
      data: rows.map((product) => ({
        businessId,
        ...product
      })),
      skipDuplicates: true
    });

    await enqueueSyncOperation({
      businessId,
      entityType: "product",
      operation: "import",
      method: "POST",
      endpoint: `/api/products/business/${businessId}/import`,
      payload: {
        products: rows
      },
      userId: req.user.id
    });

    res.status(201).json({
      imported: result.count,
      skipped: rows.length - result.count
    });
  } catch (error) {
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

    const { membership } = await getBusinessAccess(req.user, businessId);
    const canManageProducts = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager", "Store Keeper", "Pharmacist"].includes(membership?.role?.name);

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
        ...pricingChanges(req.body, existingProduct, membership?.role?.name === "Owner", req.user.systemRole === "SYSTEM_ADMIN")
      }
    });

    await enqueueSyncOperation({
      businessId,
      entityType: "product",
      entityId: product.id,
      operation: "update",
      method: "PATCH",
      endpoint: `/api/products/business/${businessId}/${productId}`,
      payload: {
        localId: product.id,
        minimumPrice: product.minimumPrice,
        barcode,
        category,
        name,
        price,
        sku,
        type,
        unit
      },
      userId: req.user.id
    });

    res.json({ product:presentProduct(await prisma.product.findUnique({where:{id:product.id},include:membership?.role?.name === "Owner" ? {privateCost:true} : undefined}),membership?.role?.name === "Owner") });
  } catch (error) {
    if (error.code === "P2002") {
      next(new HttpError(409, "Product SKU or barcode already exists for this business."));
      return;
    }

    next(error);
  }
});

function normalizeImportProduct(product, index) {
  const rowNumber = index + 1;
  const name = product.name?.trim();

  if (!name) {
    throw new HttpError(400, `Row ${rowNumber}: product name is required.`);
  }

  if (product.price === undefined || product.price === null || product.price === "") {
    throw new HttpError(400, `Row ${rowNumber}: price is required.`);
  }

  return {
    name,
    sku: normalizeOptionalCode(product.sku),
    barcode: normalizeOptionalCode(product.barcode),
    type: normalizeProductType(product.type),
    category: normalizeOptionalCode(product.category),
    unit: normalizeOptionalCode(product.unit),
    price: normalizePrice(product.price)
  };
}

productRouter.patch("/business/:businessId/:productId/status", async (req, res, next) => {
  try {
    const { businessId, productId } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      throw new HttpError(400, "Product status must be ACTIVE or INACTIVE.");
    }

    const { membership } = await getBusinessAccess(req.user, businessId);
    const canManageProducts = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager", "Store Keeper", "Pharmacist"].includes(membership?.role?.name);

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

    if (status === "ACTIVE" && existingProduct.status !== "ACTIVE") {
      await assertCanCreateProduct(businessId);
    }

    const product = await prisma.product.update({
      where: { id: existingProduct.id },
      data: { status }
    });

    await enqueueSyncOperation({
      businessId,
      entityType: "product",
      entityId: product.id,
      operation: "status",
      method: "PATCH",
      endpoint: `/api/products/business/${businessId}/${productId}/status`,
      payload: {
        localId: product.id,
        minimumPrice: product.minimumPrice,
        status
      },
      userId: req.user.id
    });

    res.json({ product:presentProduct(await prisma.product.findUnique({where:{id:product.id},include:membership?.role?.name === "Owner" ? {privateCost:true} : undefined}),membership?.role?.name === "Owner") });
  } catch (error) {
    next(error);
  }
});
