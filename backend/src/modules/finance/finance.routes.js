import { buildDateFilter } from "../../utils/reportDates.js";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { getBusinessAccess } from "../../utils/businessAccess.js";
import { HttpError } from "../../utils/httpError.js";
import { enqueueSyncOperation } from "../../utils/syncQueue.js";

export const financeRouter = Router();

financeRouter.use(requireAuth);

const financeRoles = new Set(["Owner"]);
const paymentMethods = new Set(["CASH", "CARD", "MOBILE_MONEY"]);
const expenseStatuses = new Set(["PENDING", "APPROVED", "REJECTED"]);

financeRouter.get("/business/:businessId/summary", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { branchId, dateFrom, dateTo, paymentMethod } = req.query;

    const { business } = await assertFinanceAccess(req.user, businessId);

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
    const completedWhere = {
      ...baseWhere,
      status: "COMPLETED"
    };

    const expenseWhere = {
      businessId,
      ...(branchId ? { branchId } : {}),
      ...(createdAt ? { createdAt } : {})
    };

    const [totalAggregate, paymentRows, branchRows, voidedCount, recentReceipts, approvedExpensesAggregate, pendingExpensesCount, recentExpenses] = await Promise.all([
      prisma.sale.aggregate({
        where: completedWhere,
        _count: {
          _all: true
        },
        _sum: {
          subtotal: true,
          taxAmount: true,
          total: true
        }
      }),
      prisma.sale.groupBy({
        by: ["paymentMethod"],
        where: completedWhere,
        _count: {
          _all: true
        },
        _sum: {
          subtotal: true,
          taxAmount: true,
          total: true
        }
      }),
      prisma.sale.groupBy({
        by: ["branchId"],
        where: completedWhere,
        _count: {
          _all: true
        },
        _sum: {
          subtotal: true,
          taxAmount: true,
          total: true
        }
      }),
      prisma.sale.count({
        where: {
          ...baseWhere,
          status: "VOIDED"
        }
      }),
      prisma.sale.findMany({
        where: completedWhere,
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
        orderBy: {
          createdAt: "desc"
        },
        take: 8
      }),
      prisma.expense.aggregate({
        where: {
          ...expenseWhere,
          status: "APPROVED"
        },
        _count: {
          _all: true
        },
        _sum: {
          amount: true
        }
      }),
      prisma.expense.count({
        where: {
          ...expenseWhere,
          status: "PENDING"
        }
      }),
      prisma.expense.findMany({
        where: expenseWhere,
        include: expenseInclude,
        orderBy: {
          createdAt: "desc"
        },
        take: 20
      })
    ]);

    const branchNames = await getBranchNames(branchRows.map((row) => row.branchId));
    const collectedTotal = toNumber(totalAggregate._sum.total);
    const subtotal = toNumber(totalAggregate._sum.subtotal);
    const receiptCount = totalAggregate._count._all;
    const approvedExpenseTotal = toNumber(approvedExpensesAggregate._sum.amount);

    res.json({
      finance: {
        business: {
          id: business.id,
          name: business.name,
          currency: business.currency,
          taxEnabled: business.taxEnabled,
          taxName: business.taxName,
          taxRate: business.taxRate
        },
        filters: {
          branchId: branchId || "",
          dateFrom: dateFrom || "",
          dateTo: dateTo || "",
          paymentMethod: paymentMethod || ""
        },
        summary: {
          collectedTotal,
          subtotal,
          taxCollected: toNumber(totalAggregate._sum.taxAmount),
          approvedExpenseTotal,
          netCash: collectedTotal - approvedExpenseTotal,
          receiptCount,
          voidedCount,
          approvedExpenseCount: approvedExpensesAggregate._count._all,
          pendingExpenseCount: pendingExpensesCount,
          averageReceipt: receiptCount ? collectedTotal / receiptCount : 0
        },
        paymentRows: paymentRows
          .map((row) => normalizeGroupRow({
            count: row._count._all,
            key: row.paymentMethod,
            label: formatPayment(row.paymentMethod),
            subtotal: row._sum.subtotal,
            taxAmount: row._sum.taxAmount,
            total: row._sum.total
          }))
          .sort((first, second) => second.total - first.total),
        branchRows: branchRows
          .map((row) => normalizeGroupRow({
            count: row._count._all,
            key: row.branchId,
            label: branchNames.get(row.branchId) || "Unknown branch",
            subtotal: row._sum.subtotal,
            taxAmount: row._sum.taxAmount,
            total: row._sum.total
          }))
          .sort((first, second) => second.total - first.total),
        recentReceipts,
        recentExpenses
      }
    });
  } catch (error) {
    next(error);
  }
});

financeRouter.post("/business/:businessId/expenses", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { amount, branchId, category = "General", note = "", title } = req.body;

    await assertFinanceAccess(req.user, businessId);

    if (!title?.trim()) {
      throw new HttpError(400, "Expense title is required.");
    }

    const normalizedAmount = Number(amount);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new HttpError(400, "Expense amount must be greater than zero.");
    }

    const branch = await prisma.branch.findFirst({
      where: {
        id: branchId,
        businessId,
        status: "ACTIVE"
      },
      select: {
        id: true
      }
    });

    if (!branch) {
      throw new HttpError(400, "Choose an active branch for this expense.");
    }

    const expense = await prisma.expense.create({
      data: {
        title: title.trim(),
        category: String(category || "General").trim() || "General",
        amount: normalizedAmount.toFixed(2),
        note: note?.trim() || null,
        businessId,
        branchId: branch.id,
        recordedById: req.user.id
      },
      include: expenseInclude
    });

    await enqueueSyncOperation({
      businessId,
      branchId: branch.id,
      entityType: "expense",
      entityId: expense.id,
      operation: "create",
      method: "POST",
      endpoint: `/api/finance/business/${businessId}/expenses`,
      payload: {
        localId: expense.id,
        amount,
        branchId: branch.id,
        category,
        note,
        title
      },
      userId: req.user.id
    });

    res.status(201).json({ expense });
  } catch (error) {
    next(error);
  }
});

financeRouter.patch("/business/:businessId/expenses/:expenseId/status", async (req, res, next) => {
  try {
    const { businessId, expenseId } = req.params;
    const { status } = req.body;
    const normalizedStatus = String(status || "").toUpperCase();

    await assertFinanceAccess(req.user, businessId);

    if (!expenseStatuses.has(normalizedStatus)) {
      throw new HttpError(400, "Expense status is not supported.");
    }

    const existingExpense = await prisma.expense.findFirst({
      where: {
        id: expenseId,
        businessId
      }
    });

    if (!existingExpense) {
      throw new HttpError(404, "Expense was not found.");
    }

    const expense = await prisma.expense.update({
      where: {
        id: existingExpense.id
      },
      data: {
        status: normalizedStatus,
        approvedById: normalizedStatus === "APPROVED" ? req.user.id : null,
        approvedAt: normalizedStatus === "APPROVED" ? new Date() : null
      },
      include: expenseInclude
    });

    await enqueueSyncOperation({
      businessId,
      branchId: expense.branchId,
      entityType: "expense",
      entityId: expense.id,
      operation: "status",
      method: "PATCH",
      endpoint: `/api/finance/business/${businessId}/expenses/${expenseId}/status`,
      payload: {
        localId: expense.id,
        status: normalizedStatus
      },
      userId: req.user.id
    });

    res.json({ expense });
  } catch (error) {
    next(error);
  }
});

const expenseInclude = {
  branch: {
    select: {
      id: true,
      name: true
    }
  },
  recordedBy: {
    select: {
      id: true,
      name: true
    }
  },
  approvedBy: {
    select: {
      id: true,
      name: true
    }
  }
};

async function assertFinanceAccess(user, businessId) {
  if (!prisma.expense) {
    throw new HttpError(503, "Prisma Client is out of date. Restart the backend and run npx prisma generate.");
  }

  const { business, roleName } = await getBusinessAccess(user, businessId);

  if (user.systemRole !== "SYSTEM_ADMIN" && !financeRoles.has(roleName)) {
    throw new HttpError(403, "Only the business owner can access finance.");
  }

  const financeModule = await prisma.businessModule.findUnique({
    where: {
      businessId_key: {
        businessId,
        key: "FINANCE"
      }
    }
  });

  if (user.systemRole !== "SYSTEM_ADMIN" && !financeModule?.active) {
    throw new HttpError(403, "Finance module is not active for this business.");
  }

  return { business, roleName };
}

async function getBranchNames(branchIds) {
  const uniqueBranchIds = [...new Set(branchIds.filter(Boolean))];

  if (!uniqueBranchIds.length) {
    return new Map();
  }

  const branches = await prisma.branch.findMany({
    where: {
      id: {
        in: uniqueBranchIds
      }
    },
    select: {
      id: true,
      name: true
    }
  });

  return new Map(branches.map((branch) => [branch.id, branch.name]));
}

function normalizeGroupRow({ count, key, label, subtotal, total, taxAmount }) {
  const normalizedTotal = toNumber(total);
  const normalizedSubtotal = toNumber(subtotal);

  return {
    key,
    label,
    count,
    subtotal: normalizedSubtotal,
    total: normalizedTotal,
    taxCollected: toNumber(taxAmount)
  };
}

function toNumber(value) {
  return Number(value || 0);
}

function formatPayment(method = "") {
  return method ? method.replace("_", " ").toLowerCase() : "not set";
}
