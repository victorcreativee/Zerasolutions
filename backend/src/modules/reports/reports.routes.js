import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { buildDateFilter, csvCell } from "../../utils/reportDates.js";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { getBusinessAccess } from "../../utils/businessAccess.js";
import { HttpError } from "../../utils/httpError.js";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

const reportRoles = new Set(["Owner", "Manager", "Cashier"]);
const paymentMethods = new Set(["CASH", "CARD", "MOBILE_MONEY"]);

reportsRouter.get("/business/:businessId/summary", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { branchId, dateFrom, dateTo, paymentMethod } = req.query;

    const { business, baseWhere } = await getReportContext(req);
    const completedWhere = {
      ...baseWhere,
      status: "COMPLETED"
    };

    const [totalAggregate, itemAggregate, paymentRows, branchRows, productRows, cashierRows, completedSales, voidedCount, recentReceipts] = await Promise.all([
      prisma.sale.aggregate({
        where: completedWhere,
        _count: { _all: true },
        _sum: {
          discountAmount: true,
          subtotal: true,
          taxAmount: true,
          total: true
        }
      }),
      prisma.saleItem.aggregate({
        where: {
          sale: completedWhere
        },
        _sum: {
          quantity: true
        }
      }),
      prisma.sale.groupBy({
        by: ["paymentMethod"],
        where: completedWhere,
        _count: { _all: true },
        _sum: {
          total: true
        }
      }),
      prisma.sale.groupBy({
        by: ["branchId"],
        where: completedWhere,
        _count: { _all: true },
        _sum: {
          total: true
        }
      }),
      prisma.saleItem.groupBy({
        by: ["productId"],
        where: {
          sale: completedWhere
        },
        _sum: {
          quantity: true,
          lineTotal: true
        },
        orderBy: {
          _sum: {
            lineTotal: "desc"
          }
        },
        take: 8
      }),
      prisma.sale.groupBy({
        by: ["cashierId"],
        where: completedWhere,
        _count: { _all: true },
        _sum: {
          total: true
        }
      }),
      prisma.sale.findMany({
        where: completedWhere,
        select: { total: true, posOrder: { select: { waiter: { select: { id: true, name: true } } } } }
      }),
      prisma.sale.count({
        where: {
          ...baseWhere,
          status: "VOIDED"
        }
      }),
      prisma.sale.findMany({
        where: {
          ...baseWhere,
          status: {
            in: ["COMPLETED", "VOIDED"]
          }
        },
        include: saleInclude,
        orderBy: { createdAt: "desc" },
        take: 100
      })
    ]);

    const [branchNames, productNames, cashierNames] = await Promise.all([
      getBranchNames(branchRows.map((row) => row.branchId)),
      getProductNames(productRows.map((row) => row.productId)),
      getUserNames(cashierRows.map((row) => row.cashierId))
    ]);

    const totalSales = toNumber(totalAggregate._sum.total);
    const subtotal = toNumber(totalAggregate._sum.subtotal);
    const discountTotal = toNumber(totalAggregate._sum.discountAmount);
    const taxCollected = toNumber(totalAggregate._sum.taxAmount);
    const receiptCount = totalAggregate._count._all;
    const waiterRows = buildWaiterRows(completedSales);

    res.json({
      report: {
        business: {
          id: business.id,
          name: business.name,
          currency: business.currency
        },
        filters: {
          branchId: branchId || "",
          dateFrom: dateFrom || "",
          dateTo: dateTo || "",
          paymentMethod: paymentMethod || ""
        },
        summary: {
          totalSales,
          subtotal,
          discountTotal,
          taxCollected,
          receiptCount,
          voidedCount,
          itemCount: itemAggregate._sum.quantity || 0,
          averageSale: receiptCount ? totalSales / receiptCount : 0
        },
        paymentRows: paymentRows
          .map((row) => ({
            key: row.paymentMethod,
            label: formatPayment(row.paymentMethod),
            quantity: row._count._all,
            total: toNumber(row._sum.total)
          }))
          .sort((first, second) => second.total - first.total),
        branchRows: branchRows
          .map((row) => ({
            key: row.branchId,
            label: branchNames.get(row.branchId) || "Unknown branch",
            quantity: row._count._all,
            total: toNumber(row._sum.total)
          }))
          .sort((first, second) => second.total - first.total),
        productRows: productRows.map((row) => ({
          key: row.productId,
          label: productNames.get(row.productId) || "Product",
          quantity: row._sum.quantity || 0,
          total: toNumber(row._sum.lineTotal)
        })),
        staffRows: buildStaffRows({ cashierNames, cashierRows, waiterRows }),
        recentReceipts
      }
    });
  } catch (error) {
    next(error);
  }
});

const saleInclude = {
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
};

async function getBranchNames(branchIds) {
  const uniqueIds = [...new Set(branchIds.filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map();
  }

  const branches = await prisma.branch.findMany({
    where: {
      id: {
        in: uniqueIds
      }
    },
    select: {
      id: true,
      name: true
    }
  });

  return new Map(branches.map((branch) => [branch.id, branch.name]));
}

async function getProductNames(productIds) {
  const uniqueIds = [...new Set(productIds.filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map();
  }

  const products = await prisma.product.findMany({
    where: {
      id: {
        in: uniqueIds
      }
    },
    select: {
      id: true,
      name: true
    }
  });

  return new Map(products.map((product) => [product.id, product.name]));
}

async function getUserNames(userIds) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];

  if (!uniqueIds.length) {
    return new Map();
  }

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: uniqueIds
      }
    },
    select: {
      id: true,
      name: true
    }
  });

  return new Map(users.map((user) => [user.id, user.name]));
}

function buildWaiterRows(sales) {
  return Object.values(
    sales.reduce((rows, sale) => {
      const waiter = sale.posOrder?.waiter;
      const key = waiter?.id || "counter";
      const current = rows[key] || { key, label: waiter?.name || "Counter sale", quantity: 0, total: 0 };
      rows[key] = {
        ...current,
        quantity: current.quantity + 1,
        total: current.total + toNumber(sale.total)
      };
      return rows;
    }, {})
  );
}

function buildStaffRows({ cashierNames, cashierRows, waiterRows }) {
  return [
    ...waiterRows.map((row) => ({
      ...row,
      key: `waiter-${row.key}`,
      role: "Waiter",
      unitLabel: "bill"
    })),
    ...cashierRows.map((row) => ({
      key: `cashier-${row.cashierId}`,
      label: cashierNames.get(row.cashierId) || "Unknown cashier",
      role: "Cashier",
      quantity: row._count._all,
      total: toNumber(row._sum.total),
      unitLabel: "receipt"
    }))
  ].sort((first, second) => second.total - first.total);
}

function toNumber(value) {
  return Number(value || 0);
}

function formatPayment(method = "") {
  return method
    .replace("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function getReportContext(req) {
  const { businessId } = req.params;
  const { branchId, dateFrom, dateTo, paymentMethod } = req.query;
    const { business, roleName } = await getBusinessAccess(req.user, businessId);

    if (req.user.systemRole !== "SYSTEM_ADMIN" && !reportRoles.has(roleName)) {
      throw new HttpError(403, "You do not have access to business reports.");
    }

    const activeModules = await prisma.businessModule.findMany({
      where: {
        businessId,
        key: {
          in: ["REPORTS", "POS"]
        },
        active: true
      },
      select: {
        key: true
      }
    });

    if (req.user.systemRole !== "SYSTEM_ADMIN" && activeModules.length === 0) {
      throw new HttpError(403, "Reports are not active for this business.");
    }

    if (paymentMethod && !paymentMethods.has(paymentMethod)) {
      throw new HttpError(400, "Payment method filter is not supported.");
    }

    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: {
          id: branchId,
          businessId
        },
        select: {
          id: true
        }
      });

      if (!branch) {
        throw new HttpError(404, "Branch was not found for this business.");
      }
    }

    const createdAt = buildDateFilter({ dateFrom, dateTo });
    const baseWhere = {
      businessId,
      ...(branchId ? { branchId } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(createdAt ? { createdAt } : {})
    };
    return { business, baseWhere };
}

reportsRouter.get("/business/:businessId/export", async (req, res, next) => {
  try {
    const { baseWhere } = await getReportContext(req);
    // Bound the run so newly created sales cannot continually extend a download.
    const startedAt = new Date();
    const where = { AND: [baseWhere, { createdAt: { lte: startedAt } }] };
    async function* rows() {
      yield "\ufeff" + ["Receipt", "Date (UTC)", "Branch", "Customer", "Payment", "Cashier", "Status", "Subtotal", "Discount", "Tax", "Total"].map(csvCell).join(",") + "\r\n";
      let cursor;
      while (!res.destroyed) {
        const sales = await prisma.sale.findMany({
          where: cursor ? { AND: [where, { id: { gt: cursor } }] } : where,
          select: { id: true, receiptNumber: true, createdAt: true, paymentMethod: true, status: true, subtotal: true, discountAmount: true, taxAmount: true, total: true,
            branch: { select: { name: true } }, customer: { select: { name: true } }, cashier: { select: { name: true } } },
          orderBy: { id: "asc" }, take: 500
        });
        if (!sales.length) break;
        for (const sale of sales) {
          yield [sale.receiptNumber, sale.createdAt.toISOString(), sale.branch?.name, sale.customer?.name || "Walk-in", sale.paymentMethod, sale.cashier?.name, sale.status,
            Number(sale.subtotal), Number(sale.discountAmount), Number(sale.taxAmount), Number(sale.total)].map(csvCell).join(",") + "\r\n";
        }
        cursor = sales.at(-1).id;
      }
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="zera-sales-report.csv"');
    await pipeline(Readable.from(rows()), res);
  } catch (error) {
    if (res.headersSent || res.destroyed) { res.destroy(error); return; }
    next(error);
  }
});
