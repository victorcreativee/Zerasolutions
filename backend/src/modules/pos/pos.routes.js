import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";
import { canRecordSale } from "../../utils/businessRoles.js";

export const posRouter = Router();

posRouter.use(requireAuth);

function getEffectivePOSMode(business) {
  const type = (business?.type || "").toLowerCase();

  if (business?.posMode === "TABLE_SERVICE" || type.includes("bar") || type.includes("restaurant")) {
    return "TABLE_SERVICE";
  }

  return "RETAIL_CHECKOUT";
}

const activeOrderStatuses = ["OPEN", "BILL_PRINTED"];

const orderInclude = {
  branch: {
    select: {
      id: true,
      name: true
    }
  },
  waiter: {
    select: {
      id: true,
      name: true
    }
  },
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      email: true
    }
  },
  table: {
    select: {
      id: true,
      name: true,
      seats: true,
      status: true
    }
  },
  sale: {
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
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true
        }
      },
      table: {
        select: {
          id: true,
          name: true,
          seats: true,
          status: true
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
              unit: true,
              price: true
            }
          }
        }
      }
    }
  },
  items: {
    where: {
      status: "ACTIVE"
    },
    include: {
      product: {
        select: {
              id: true,
              name: true,
              type: true,
              category: true,
              unit: true,
              price: true
        }
      }
    }
  }
};

function canPayTableBill(roleName, systemRole) {
  return systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager", "Cashier"].includes(roleName);
}

function canOpenTableBill(roleName, systemRole, business) {
  return systemRole === "SYSTEM_ADMIN" || canRecordSale(roleName, business);
}

async function getPhysicalSaleQuantities(transaction, businessId, saleItems) {
  const quantitiesByProduct = saleItems.reduce((totals, item) => {
    totals.set(item.productId, (totals.get(item.productId) || 0) + item.quantity);
    return totals;
  }, new Map());
  const productIds = [...quantitiesByProduct.keys()];

  if (productIds.length === 0) {
    return [];
  }

  const physicalProducts = await transaction.product.findMany({
    where: {
      businessId,
      id: { in: productIds },
      type: "PHYSICAL"
    },
    select: {
      id: true,
      name: true
    }
  });

  return physicalProducts.map((product) => ({
    product,
    quantity: quantitiesByProduct.get(product.id) || 0
  }));
}

async function deductStockForSale(transaction, { branchId, businessId, receiptNumber, saleItems, userId }) {
  if (!transaction.inventoryStock || !transaction.stockAdjustment) {
    throw new HttpError(503, "Prisma Client is out of date. Restart the backend and run npx prisma generate.");
  }

  const stockItems = await getPhysicalSaleQuantities(transaction, businessId, saleItems);

  for (const item of stockItems) {
    const currentStock = await transaction.inventoryStock.upsert({
      where: {
        productId_branchId: {
          productId: item.product.id,
          branchId
        }
      },
      create: {
        businessId,
        branchId,
        productId: item.product.id,
        quantity: 0,
        reorderLevel: 0
      },
      update: {}
    });
    const nextQuantity = currentStock.quantity - item.quantity;

    await transaction.inventoryStock.update({
      where: { id: currentStock.id },
      data: { quantity: nextQuantity }
    });

    await transaction.stockAdjustment.create({
      data: {
        type: "DECREASE",
        quantityBefore: currentStock.quantity,
        quantityChange: -item.quantity,
        quantityAfter: nextQuantity,
        note: `Sale ${receiptNumber}`,
        businessId,
        branchId,
        productId: item.product.id,
        userId
      }
    });
  }
}

async function restoreStockForVoidedSale(transaction, { businessId, receiptNumber, userId }) {
  if (!transaction.inventoryStock || !transaction.stockAdjustment) {
    throw new HttpError(503, "Prisma Client is out of date. Restart the backend and run npx prisma generate.");
  }

  const saleDeductions = await transaction.stockAdjustment.findMany({
    where: {
      businessId,
      note: `Sale ${receiptNumber}`,
      type: "DECREASE"
    }
  });

  for (const deduction of saleDeductions) {
    const currentStock = await transaction.inventoryStock.upsert({
      where: {
        productId_branchId: {
          productId: deduction.productId,
          branchId: deduction.branchId
        }
      },
      create: {
        businessId,
        branchId: deduction.branchId,
        productId: deduction.productId,
        quantity: 0,
        reorderLevel: 0
      },
      update: {}
    });
    const restoredQuantity = Math.abs(deduction.quantityChange);
    const nextQuantity = currentStock.quantity + restoredQuantity;

    await transaction.inventoryStock.update({
      where: { id: currentStock.id },
      data: { quantity: nextQuantity }
    });

    await transaction.stockAdjustment.create({
      data: {
        type: "INCREASE",
        quantityBefore: currentStock.quantity,
        quantityChange: restoredQuantity,
        quantityAfter: nextQuantity,
        note: `Voided ${receiptNumber}`,
        businessId,
        branchId: deduction.branchId,
        productId: deduction.productId,
        userId
      }
    });
  }
}

async function assertBusinessAccess({ businessId, userId, systemRole }) {
  const membership = await prisma.businessUser.findUnique({
    where: {
      userId_businessId: {
        userId,
        businessId
      }
    },
    include: { role: true }
  });

  if (!membership && systemRole !== "SYSTEM_ADMIN") {
    throw new HttpError(403, "You do not have access to this business.");
  }

  return membership;
}

async function getActiveTableOrder({ businessId, branchId, tableId }) {
  return prisma.pOSOrder.findFirst({
    where: {
      businessId,
      branchId,
      tableId,
      status: {
        in: activeOrderStatuses
      }
    },
    include: orderInclude,
    orderBy: {
      createdAt: "desc"
    }
  });
}

posRouter.get("/tables/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { branchId } = req.query;

    if (!prisma.pOSOrder) {
      throw new HttpError(503, "Prisma Client is out of date. Restart the backend and run npx prisma generate.");
    }

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

    const tableIds = tables.map((table) => table.id);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const tableSales = tableIds.length
      ? await prisma.sale.findMany({
          where: {
            businessId,
            branchId,
            tableId: { in: tableIds },
            status: "COMPLETED",
            createdAt: {
              gte: todayStart,
              lte: todayEnd
            }
          },
          select: {
            id: true,
            receiptNumber: true,
            tableId: true,
            total: true,
            createdAt: true
          },
          orderBy: {
            createdAt: "desc"
          }
        })
      : [];
    const openTableOrders = tableIds.length
      ? await prisma.pOSOrder.findMany({
          where: {
            businessId,
            branchId,
            tableId: { in: tableIds },
            status: {
              in: activeOrderStatuses
            }
          },
          select: {
            id: true,
            orderNumber: true,
            tableId: true,
            total: true,
            status: true,
            updatedAt: true,
            _count: {
              select: {
                items: true
              }
            }
          },
          orderBy: {
            updatedAt: "desc"
          }
        })
      : [];

    const tablesWithServiceSummary = tables.map((table) => {
      const salesForTable = tableSales.filter((sale) => sale.tableId === table.id);
      const activeOrder = openTableOrders.find((order) => order.tableId === table.id) || null;
      const todaySalesTotal = salesForTable.reduce((total, sale) => total + Number(sale.total), 0);
      const lastSale = salesForTable[0] || null;

      return {
        ...table,
        serviceSummary: {
          todaySalesCount: salesForTable.length,
          todaySalesTotal,
          lastReceiptNumber: lastSale?.receiptNumber || null,
          lastSaleAt: lastSale?.createdAt || null,
          activeOrder: activeOrder
            ? {
                id: activeOrder.id,
                orderNumber: activeOrder.orderNumber,
                total: Number(activeOrder.total),
                status: activeOrder.status,
                itemCount: activeOrder._count.items,
                updatedAt: activeOrder.updatedAt
              }
            : null
        }
      };
    });

    res.json({ tables: tablesWithServiceSummary });
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

posRouter.get("/orders/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { branchId, tableId, status = "OPEN" } = req.query;

    if (!branchId) {
      throw new HttpError(400, "Branch is required.");
    }

    await assertBusinessAccess({
      businessId,
      userId: req.user.id,
      systemRole: req.user.systemRole
    });

    const statuses =
      status === "ACTIVE"
        ? activeOrderStatuses
        : status
          ? String(status)
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : activeOrderStatuses;

    const orders = await prisma.pOSOrder.findMany({
      where: {
        businessId,
        branchId,
        ...(tableId ? { tableId } : {}),
        status: {
          in: statuses
        }
      },
      include: orderInclude,
      orderBy: {
        updatedAt: "desc"
      },
      take: 100
    });

    res.json({ orders });
  } catch (error) {
    next(error);
  }
});

posRouter.get("/orders/table/:tableId/active", async (req, res, next) => {
  try {
    const { tableId } = req.params;
    const { businessId, branchId } = req.query;

    if (!businessId || !branchId) {
      throw new HttpError(400, "Business and branch are required.");
    }

    await assertBusinessAccess({
      businessId,
      userId: req.user.id,
      systemRole: req.user.systemRole
    });

    const order = await getActiveTableOrder({ businessId, branchId, tableId });
    res.json({ order });
  } catch (error) {
    next(error);
  }
});

posRouter.post("/orders", async (req, res, next) => {
  try {
    const { businessId, branchId, customerId, tableId, items } = req.body;

    if (!businessId || !branchId || !tableId || !Array.isArray(items) || items.length === 0) {
      throw new HttpError(400, "Business, branch, table, and order items are required.");
    }

    const membership = await assertBusinessAccess({
      businessId,
      userId: req.user.id,
      systemRole: req.user.systemRole
    });

    const [business, branch, posModule, customer, table] = await Promise.all([
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
      }),
      customerId
        ? prisma.customer.findFirst({
            where: {
              id: customerId,
              businessId,
              status: "ACTIVE"
            }
          })
        : null,
      prisma.pOSTable.findFirst({
        where: {
          id: tableId,
          businessId,
          branchId,
          status: {
            not: "INACTIVE"
          }
        }
      })
    ]);

    if (!business || business.status !== "ACTIVE") {
      throw new HttpError(400, "Business is not active.");
    }

    if (getEffectivePOSMode(business) !== "TABLE_SERVICE") {
      throw new HttpError(400, "Open table bills are only available for bar and restaurant POS.");
    }

    const roleName = membership?.role?.name || req.user.systemRole;

    if (!canOpenTableBill(roleName, req.user.systemRole, business)) {
      throw new HttpError(403, "You do not have access to open table bills.");
    }

    if (!branch || branch.status !== "ACTIVE") {
      throw new HttpError(400, "Branch is not active.");
    }

    if (!posModule?.active) {
      throw new HttpError(400, "POS module is not active for this business.");
    }

    if (customerId && !customer) {
      throw new HttpError(400, "Selected customer is not active in this business.");
    }

    if (!table) {
      throw new HttpError(400, "Selected table is not available for this branch.");
    }

    const normalizedItems = items.map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity)
    }));

    if (normalizedItems.some((item) => !item.productId || !Number.isInteger(item.quantity) || item.quantity <= 0)) {
      throw new HttpError(400, "Each order item must have a product and positive quantity.");
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

    const orderItems = normalizedItems.map((item) => {
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

    const order = await prisma.$transaction(async (transaction) => {
      const existingOrder = await transaction.pOSOrder.findFirst({
        where: {
          businessId,
          branchId,
          tableId,
          status: {
            in: activeOrderStatuses
          }
        },
        include: {
          items: {
            where: {
              status: "ACTIVE"
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      if (existingOrder) {
        const subtotal =
          existingOrder.items.reduce((total, item) => total + Number(item.lineTotal), 0) +
          orderItems.reduce((total, item) => total + Number(item.lineTotal), 0);

        await transaction.pOSOrderItem.createMany({
          data: orderItems.map((item) => ({
            ...item,
            orderId: existingOrder.id
          }))
        });

        return transaction.pOSOrder.update({
          where: {
            id: existingOrder.id
          },
          data: {
            subtotal: subtotal.toFixed(2),
            total: subtotal.toFixed(2),
            customerId: customer?.id || existingOrder.customerId,
            status: "OPEN"
          },
          include: orderInclude
        });
      }

      const subtotal = orderItems.reduce((total, item) => total + Number(item.lineTotal), 0);

      const createdOrder = await transaction.pOSOrder.create({
        data: {
          orderNumber: `ZO-${Date.now()}`,
          subtotal: subtotal.toFixed(2),
          total: subtotal.toFixed(2),
          businessId,
          branchId,
          tableId,
          waiterId: req.user.id,
          customerId: customer?.id || null,
          items: {
            create: orderItems
          }
        },
        include: orderInclude
      });

      await transaction.pOSTable.update({
        where: {
          id: table.id
        },
        data: {
          status: "OCCUPIED"
        }
      });

      return createdOrder;
    });

    res.status(201).json({ order });
  } catch (error) {
    next(error);
  }
});

posRouter.patch("/orders/:orderId/bill-printed", async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const existingOrder = await prisma.pOSOrder.findUnique({
      where: { id: orderId },
      include: {
        business: true
      }
    });

    if (!existingOrder) {
      throw new HttpError(404, "Table bill was not found.");
    }

    const membership = await assertBusinessAccess({
      businessId: existingOrder.businessId,
      userId: req.user.id,
      systemRole: req.user.systemRole
    });

    const roleName = membership?.role?.name || req.user.systemRole;

    if (!canOpenTableBill(roleName, req.user.systemRole, existingOrder.business)) {
      throw new HttpError(403, "You do not have access to update this bill.");
    }

    if (!activeOrderStatuses.includes(existingOrder.status)) {
      throw new HttpError(400, "Only open table bills can be marked as printed.");
    }

    const order = await prisma.pOSOrder.update({
      where: { id: orderId },
      data: {
        status: "BILL_PRINTED"
      },
      include: orderInclude
    });

    res.json({ order });
  } catch (error) {
    next(error);
  }
});

posRouter.patch("/orders/:orderId/pay", async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod = "CASH", customerId } = req.body;

    if (!["CASH", "CARD", "MOBILE_MONEY"].includes(paymentMethod)) {
      throw new HttpError(400, "Payment method is not supported.");
    }

    const existingOrder = await prisma.pOSOrder.findUnique({
      where: { id: orderId },
      include: {
        business: true,
        items: {
          where: {
            status: "ACTIVE"
          },
          include: {
            product: true
          }
        }
      }
    });

    if (!existingOrder) {
      throw new HttpError(404, "Table bill was not found.");
    }

    const membership = await assertBusinessAccess({
      businessId: existingOrder.businessId,
      userId: req.user.id,
      systemRole: req.user.systemRole
    });

    const roleName = membership?.role?.name || req.user.systemRole;

    if (!canPayTableBill(roleName, req.user.systemRole)) {
      throw new HttpError(403, "Only a cashier, manager, or owner can receive payment for a table bill.");
    }

    if (!activeOrderStatuses.includes(existingOrder.status)) {
      throw new HttpError(400, "Only open table bills can be paid.");
    }

    if (!existingOrder.items.length) {
      throw new HttpError(400, "This table bill has no active items.");
    }

    const customer = customerId
      ? await prisma.customer.findFirst({
          where: {
            id: customerId,
            businessId: existingOrder.businessId,
            status: "ACTIVE"
          }
        })
      : null;

    if (customerId && !customer) {
      throw new HttpError(400, "Selected customer is not active in this business.");
    }

    const sale = await prisma.$transaction(async (transaction) => {
      const saleItems = existingOrder.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice).toFixed(2),
        lineTotal: Number(item.lineTotal).toFixed(2)
      }));
      const subtotal = saleItems.reduce((total, item) => total + Number(item.lineTotal), 0);

      const paidSale = await transaction.sale.create({
        data: {
          receiptNumber: `ZS-${Date.now()}`,
          subtotal: subtotal.toFixed(2),
          total: subtotal.toFixed(2),
          paymentMethod,
          businessId: existingOrder.businessId,
          branchId: existingOrder.branchId,
          tableId: existingOrder.tableId,
          customerId: customer?.id || existingOrder.customerId || null,
          cashierId: req.user.id,
          items: {
            create: saleItems
          }
        }
      });

      await deductStockForSale(transaction, {
        businessId: existingOrder.businessId,
        branchId: existingOrder.branchId,
        receiptNumber: paidSale.receiptNumber,
        saleItems,
        userId: req.user.id
      });

      await transaction.pOSOrder.update({
        where: {
          id: existingOrder.id
        },
        data: {
          status: "PAID",
          saleId: paidSale.id,
          customerId: customer?.id || existingOrder.customerId || null,
          total: subtotal.toFixed(2),
          subtotal: subtotal.toFixed(2)
        }
      });

      const remainingOpenOrders = await transaction.pOSOrder.count({
        where: {
          businessId: existingOrder.businessId,
          branchId: existingOrder.branchId,
          tableId: existingOrder.tableId,
          status: {
            in: activeOrderStatuses
          }
        }
      });

      if (remainingOpenOrders === 0) {
        await transaction.pOSTable.update({
          where: {
            id: existingOrder.tableId
          },
          data: {
            status: "AVAILABLE"
          }
        });
      }

      return transaction.sale.findUnique({
        where: {
          id: paidSale.id
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
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true
            }
          },
          table: {
            select: {
              id: true,
              name: true,
              seats: true,
              status: true
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
    });

    res.json({ sale });
  } catch (error) {
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
          type: true,
          posMode: true,
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
    const roleAllowed = req.user.systemRole === "SYSTEM_ADMIN" || canRecordSale(roleName, business);

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
    const { branchId, customerId, dateFrom, dateTo, paymentMethod, status } = req.query;

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
        ...(customerId ? { customerId } : {}),
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
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        table: {
          select: {
            id: true,
            name: true,
            seats: true,
            status: true
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
        },
        posOrder: {
          include: {
            waiter: {
              select: {
                id: true,
                name: true
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

    const sale = await prisma.$transaction(async (transaction) => {
      const voidedSale = await transaction.sale.update({
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
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true
            }
          },
          table: {
            select: {
              id: true,
              name: true,
              seats: true,
              status: true
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

      await restoreStockForVoidedSale(transaction, {
        businessId,
        receiptNumber: voidedSale.receiptNumber,
        userId: req.user.id
      });

      return voidedSale;
    });

    res.json({ sale });
  } catch (error) {
    next(error);
  }
});

posRouter.post("/sales", async (req, res, next) => {
  try {
    const { businessId, branchId, customerId, tableId, paymentMethod, items } = req.body;

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

    const [business, branch, posModule, customer, table] = await Promise.all([
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
      }),
      customerId
        ? prisma.customer.findFirst({
            where: {
              id: customerId,
              businessId,
              status: "ACTIVE"
            }
          })
        : null,
      tableId
        ? prisma.pOSTable.findFirst({
            where: {
              id: tableId,
              businessId,
              branchId,
              status: {
                not: "INACTIVE"
              }
            }
          })
        : null
    ]);

    if (!business || business.status !== "ACTIVE") {
      throw new HttpError(400, "Business is not active.");
    }

    const roleName = membership?.role?.name || req.user.systemRole;
    const roleAllowed = req.user.systemRole === "SYSTEM_ADMIN" || canRecordSale(roleName, business);

    if (!roleAllowed || (!membership && req.user.systemRole !== "SYSTEM_ADMIN")) {
      throw new HttpError(403, "You do not have access to record sales for this business.");
    }

    if (!branch || branch.status !== "ACTIVE") {
      throw new HttpError(400, "Branch is not active.");
    }

    if (!posModule?.active) {
      throw new HttpError(400, "POS module is not active for this business.");
    }

    if (customerId && !customer) {
      throw new HttpError(400, "Selected customer is not active in this business.");
    }

    const effectivePOSMode = getEffectivePOSMode(business);

    if (effectivePOSMode === "TABLE_SERVICE" && !tableId) {
      throw new HttpError(400, "Select a table before recording this bar or restaurant sale.");
    }

    if (effectivePOSMode === "TABLE_SERVICE" && roleName === "Waiter") {
      throw new HttpError(403, "Waiters can send table orders. A cashier must receive payment and print the receipt.");
    }

    if (tableId && !table) {
      throw new HttpError(400, "Selected table is not available for this branch.");
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

    const sale = await prisma.$transaction(async (transaction) => {
      const recordedSale = await transaction.sale.create({
        data: {
          receiptNumber,
          subtotal: subtotal.toFixed(2),
          total: subtotal.toFixed(2),
          paymentMethod,
          businessId,
          branchId,
          customerId: customer?.id || null,
          tableId: table?.id || null,
          cashierId: req.user.id,
          items: {
            create: saleItems
          }
        }
      });

      await deductStockForSale(transaction, {
        businessId,
        branchId,
        receiptNumber,
        saleItems,
        userId: req.user.id
      });

      if (table?.id) {
        await transaction.pOSTable.update({
          where: {
            id: table.id
          },
          data: {
            status: "AVAILABLE"
          }
        });
      }

      return transaction.sale.findUnique({
        where: { id: recordedSale.id },
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
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true
            }
          },
          table: {
            select: {
              id: true,
              name: true,
              seats: true,
              status: true
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
    });

    res.status(201).json({ sale });
  } catch (error) {
    next(error);
  }
});
