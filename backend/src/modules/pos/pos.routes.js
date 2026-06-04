import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";

export const posRouter = Router();

posRouter.use(requireAuth);
posRouter.get("/tables/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { branchId } = req.query;

    if (!branchId) {
      throw new HttpError(400, "Branch is required.");
    }

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

    const tables = await prisma.pOSTable.findMany({
      where: {
        businessId,
        branchId
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    res.json({ tables });
  } catch (error) {
    next(error);
  }
});

posRouter.post("/tables", async (req, res, next) => {
  try {
    const { businessId, branchId, name, seats = 4 } = req.body;

    if (!businessId || !branchId || !name) {
      throw new HttpError(400, "Business, branch, and table name are required.");
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

    const roleName = membership?.role?.name || req.user.systemRole;
    const canManageTables = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager"].includes(roleName);

    if (!canManageTables) {
      throw new HttpError(403, "Only owner or manager can add tables.");
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        businessId,
        status: "ACTIVE"
      }
    });

    if (!branch) {
      throw new HttpError(404, "Active branch was not found.");
    }

    const table = await prisma.pOSTable.create({
      data: {
        businessId,
        branchId,
        name: name.trim(),
        seats: Number(seats) || 4
      }
    });

    res.status(201).json({ table });
  } catch (error) {
    if (error.code === "P2002") {
      next(new HttpError(409, "A table with this name already exists in this branch."));
      return;
    }

    next(error);
  }
});
posRouter.get("/readiness/:businessId/:branchId", async (req, res, next) => {
  try {
    const { businessId, branchId } = req.params;

    const membership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: req.user.id,
          businessId
        }
      },
      include: { role: true }
    });

    if (!membership && req.user.systemRole !== "SYSTEM_ADMIN") {
      throw new HttpError(403, "You do not have access to this POS workspace.");
    }

    const [business, branch, posModule, activeProductCount] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          name: true,
          status: true,
          currency: true
        }
      }),
      prisma.branch.findFirst({
        where: {
          id: branchId,
          businessId
        },
        select: {
          id: true,
          name: true,
          status: true
        }
      }),
      prisma.businessModule.findUnique({
        where: {
          businessId_key: {
            businessId,
            key: "POS"
          }
        }
      }),
      prisma.product.count({
        where: {
          businessId,
          status: "ACTIVE"
        }
      })
    ]);

    if (!business) {
      throw new HttpError(404, "Business was not found.");
    }

    if (!branch) {
      throw new HttpError(404, "Branch was not found.");
    }

    const roleName = membership?.role?.name || req.user.systemRole;
    const roleAllowed = ["Owner", "Manager", "Cashier"].includes(roleName);

    res.json({
      readiness: {
        business,
        branch,
        roleName,
        checks: {
          businessActive: business.status === "ACTIVE",
          branchActive: branch.status === "ACTIVE",
          posActive: Boolean(posModule?.active),
          roleAllowed,
          productCatalogReady: activeProductCount > 0,
          salesEngineReady: false,
          paymentsReady: false
        },
        activeProductCount
      }
    });
  } catch (error) {
    next(error);
  }
});

posRouter.get("/sales/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { branchId, dateFrom, dateTo, paymentMethod, status } = req.query;

    if (!prisma.sale) {
      throw new HttpError(503, "Prisma Client is out of date. Restart the backend and run npx prisma generate.");
    }

    const membership = await prisma.businessUser.findUnique({
      where: {
        userId_businessId: {
          userId: req.user.id,
          businessId
        }
      }
    });

    if (!membership && req.user.systemRole !== "SYSTEM_ADMIN") {
      throw new HttpError(403, "You do not have access to these sales.");
    }

    if (status && !["COMPLETED", "VOIDED"].includes(status)) {
      throw new HttpError(400, "Sale status filter is not supported.");
    }

    if (paymentMethod && !["CASH", "CARD", "MOBILE_MONEY"].includes(paymentMethod)) {
      throw new HttpError(400, "Payment method filter is not supported.");
    }

    const createdAt = {};

    if (dateFrom) {
      createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }

    if (dateTo) {
      createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
    }

    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        ...(branchId ? { branchId } : {}),
        ...(status ? { status } : {}),
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(Object.keys(createdAt).length ? { createdAt } : {})
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        cashier: {
          select: {
            id: true,
            name: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                type: true,
                category: true,
                unit: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    res.json({ sales });
  } catch (error) {
    next(error);
  }
});

posRouter.patch("/sales/business/:businessId/:saleId/void", async (req, res, next) => {
  try {
    const { businessId, saleId } = req.params;

    if (!prisma.sale) {
      throw new HttpError(503, "Prisma Client is out of date. Restart the backend and run npx prisma generate.");
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

    const canVoidSales = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager"].includes(membership?.role?.name);

    if (!canVoidSales) {
      throw new HttpError(403, "Only the business owner or manager can void sales.");
    }

    const existingSale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId
      }
    });

    if (!existingSale) {
      throw new HttpError(404, "Sale was not found.");
    }

    if (existingSale.status === "VOIDED") {
      throw new HttpError(400, "Sale is already voided.");
    }

    const sale = await prisma.sale.update({
      where: { id: existingSale.id },
      data: { status: "VOIDED" },
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        cashier: {
          select: {
            id: true,
            name: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                type: true,
                category: true,
                unit: true
              }
            }
          }
        }
      }
    });

    res.json({ sale });
  } catch (error) {
    next(error);
  }
});

posRouter.post("/sales", async (req, res, next) => {
  try {
    const { businessId, branchId, paymentMethod, items } = req.body;

    if (!prisma.sale) {
      throw new HttpError(503, "Prisma Client is out of date. Restart the backend and run npx prisma generate.");
    }

    if (!businessId || !branchId || !paymentMethod || !Array.isArray(items) || items.length === 0) {
      throw new HttpError(400, "Business, branch, payment method, and sale items are required.");
    }

    if (!["CASH", "CARD", "MOBILE_MONEY"].includes(paymentMethod)) {
      throw new HttpError(400, "Payment method is not supported.");
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

    const roleName = membership?.role?.name || req.user.systemRole;
    const roleAllowed = ["Owner", "Manager", "Cashier"].includes(roleName);

    if (!roleAllowed || (!membership && req.user.systemRole !== "SYSTEM_ADMIN")) {
      throw new HttpError(403, "You do not have access to record sales for this business.");
    }

    const [business, branch, posModule] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId }
      }),
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
            key: "POS"
          }
        }
      })
    ]);

    if (!business || business.status !== "ACTIVE") {
      throw new HttpError(400, "Business is not active.");
    }

    if (!branch || branch.status !== "ACTIVE") {
      throw new HttpError(400, "Branch is not active.");
    }

    if (!posModule?.active) {
      throw new HttpError(400, "POS module is not active for this business.");
    }

    const normalizedItems = items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity)
    }));

    if (normalizedItems.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      throw new HttpError(400, "Each sale item must have a product and positive quantity.");
    }

    const productIds = [...new Set(normalizedItems.map((item) => item.productId))];
    const products = await prisma.product.findMany({
      where: {
        businessId,
        id: { in: productIds },
        status: "ACTIVE"
      }
    });

    if (products.length !== productIds.length) {
      throw new HttpError(400, "One or more products are not active in this business.");
    }

    const saleItems = normalizedItems.map((item) => {
      const product = products.find((productItem) => productItem.id === item.productId);
      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * item.quantity;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        lineTotal: lineTotal.toFixed(2)
      };
    });

    const subtotal = saleItems.reduce((total, item) => total + Number(item.lineTotal), 0);
    const receiptNumber = `ZS-${Date.now()}`;

    const sale = await prisma.sale.create({
      data: {
        receiptNumber,
        subtotal: subtotal.toFixed(2),
        total: subtotal.toFixed(2),
        paymentMethod,
        businessId,
        branchId,
        cashierId: req.user.id,
        items: {
          create: saleItems
        }
      },
      include: {
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        cashier: {
          select: {
            id: true,
            name: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                type: true,
                category: true,
                unit: true
              }
            }
          }
        }
      }
    });

    res.status(201).json({ sale });
  } catch (error) {
    next(error);
  }
});
