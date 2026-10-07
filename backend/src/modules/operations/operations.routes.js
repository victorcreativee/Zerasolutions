import { cashCountRouter } from "./cashCount.routes.js";
import { operationsDay } from "../../utils/operationsDay.js";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { getBusinessAccess } from "../../utils/businessAccess.js";
import { HttpError } from "../../utils/httpError.js";

export const operationsRouter = Router();

operationsRouter.use(requireAuth);
operationsRouter.use(cashCountRouter);

const operationsRoles = new Set(["Owner", "Manager"]);
const activeOrderStatuses = ["OPEN", "BILL_PRINTED"];

operationsRouter.get("/business/:businessId/summary", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { branchId } = req.query;

    const { business, roleName } = await getBusinessAccess(req.user, businessId);

    if (req.user.systemRole !== "SYSTEM_ADMIN" && !operationsRoles.has(roleName)) {
      throw new HttpError(403, "Only the owner or manager can access operations.");
    }

    const [modules, branches, operationsModule, products] = await Promise.all([
      prisma.businessModule.findMany({
        where: { businessId },
        orderBy: { key: "asc" }
      }),
      prisma.branch.findMany({
        where: { businessId },
        orderBy: [{ status: "asc" }, { name: "asc" }]
      }),
      prisma.businessModule.findUnique({
        where: {
          businessId_key: {
            businessId,
            key: "OPERATIONS"
          }
        }
      }),
      prisma.product.findMany({
        where: { businessId },
        orderBy: [{ status: "asc" }, { name: "asc" }]
      })
    ]);

    if (req.user.systemRole !== "SYSTEM_ADMIN" && !operationsModule?.active) {
      throw new HttpError(403, "Operations module is not active for this business.");
    }

    const activeModuleKeys = modules.filter((module) => module.active).map((module) => module.key);
    const activeBranches = branches.filter((branch) => branch.status === "ACTIVE");
    const selectedBranch =
      branches.find((branch) => branch.id === branchId) ||
      activeBranches[0] ||
      branches[0] ||
      null;

    if (branchId && (!selectedBranch || selectedBranch.id !== branchId)) {
      throw new HttpError(404, "Branch was not found for this business.");
    }

    const salesDate = req.query.date || new Date().toISOString().slice(0,10);
    const salesRange = operationsDay(salesDate, req.query.startOffset ?? 0, req.query.endOffset ?? req.query.startOffset ?? 0);
    const salesGroups = selectedBranch && business.features.dailySales ? await prisma.sale.groupBy({
      by:["status","paymentMethod"],
      where:{businessId,branchId:selectedBranch.id,createdAt:salesRange},
      _count:{_all:true},_sum:{total:true,discountAmount:true,taxAmount:true}
    }) : [];
    const completed = salesGroups.filter(group=>group.status === "COMPLETED");
    const dailySales = {
      date:salesDate, from:salesRange.gte, to:salesRange.lt,
      receipts:completed.reduce((sum,group)=>sum+group._count._all,0),
      total:completed.reduce((sum,group)=>sum+Number(group._sum.total || 0),0),
      discounts:completed.reduce((sum,group)=>sum+Number(group._sum.discountAmount || 0),0),
      tax:completed.reduce((sum,group)=>sum+Number(group._sum.taxAmount || 0),0),
      voided:salesGroups.filter(group=>group.status === "VOIDED").reduce((sum,group)=>sum+group._count._all,0),
      payments:completed.map(group=>({method:group.paymentMethod,count:group._count._all,total:Number(group._sum.total || 0)}))
    };

    const activeProducts = products.filter((product) => product.status === "ACTIVE");
    const physicalProducts = activeProducts.filter((product) => product.type === "PHYSICAL");
    const missingCodeProducts = physicalProducts.filter((product) => !product.sku && !product.barcode);
    const inventoryEnabled = activeModuleKeys.includes("INVENTORY");
    const tableService = business.posMode === "TABLE_SERVICE";

    const [stockItems, tableRows, openOrders] = await Promise.all([
      inventoryEnabled && selectedBranch
        ? getInventorySnapshot({ businessId, branchId: selectedBranch.id })
        : Promise.resolve([]),
      tableService && selectedBranch
        ? getTableRows({ businessId, branchId: selectedBranch.id })
        : Promise.resolve([]),
      tableService && selectedBranch
        ? getOpenOrders({ businessId, branchId: selectedBranch.id })
        : Promise.resolve([])
    ]);

    const lowStockItems = stockItems.filter((stock) => stock.reorderLevel > 0 && Number(stock.quantity || 0) <= Number(stock.reorderLevel || 0));
    const occupiedTables = tableRows.filter((table) => Boolean(table.order));
    const openOrdersTotal = openOrders.reduce((total, order) => total + Number(order.total || 0), 0);

    const cashCounts = selectedBranch && business.features.cashCounts ? await prisma.cashCount.findMany({
      where:{businessId,branchId:selectedBranch.id,date:salesDate},
      orderBy:[{createdAt:'desc'},{id:'desc'}],take:20,
      select:{id:true,opening:true,cashSales:true,cashIn:true,cashOut:true,expected:true,counted:true,difference:true,note:true,currency:true,createdAt:true,periodStart:true,periodEnd:true,recordedBy:{select:{name:true}}}
    }) : [];
    res.json({
      operations: {
        cashCounts,
        features: business.features,
        dailySales: business.features.dailySales ? dailySales : null,
        business: {
          id: business.id,
          name: business.name,
          currency: business.currency,
          posMode: business.posMode
        },
        branch: selectedBranch,
        activeModuleKeys,
        branches,
        products: {
          activeItems: business.features.productIssues ? activeProducts : [],
          activeCount: activeProducts.length,
          physicalCount: physicalProducts.length,
          missingCodeProducts
        },
        inventory: {
          enabled: inventoryEnabled,
          stockItems,
          lowStockItems
        },
        service: {
          tableService,
          tableRows,
          openOrders,
          openOrdersTotal
        },
        metrics: {
          activeBranches: activeBranches.length,
          totalBranches: branches.length,
          activeProducts: activeProducts.length,
          stockAlerts: inventoryEnabled ? lowStockItems.length : null,
          occupiedTables: occupiedTables.length,
          totalTables: tableRows.length,
          openOrders: openOrders.length,
          openOrdersTotal
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

async function getInventorySnapshot({ businessId, branchId }) {
  return prisma.inventoryStock.findMany({
    where: {
      businessId,
      branchId,
      product: {
        type: "PHYSICAL",
        status: "ACTIVE"
      }
    },
    include: {
      product: true,
      branch: true
    },
    orderBy: [{ product: { name: "asc" } }]
  });
}

async function getTableRows({ businessId, branchId }) {
  const [tables, openOrders] = await Promise.all([
    prisma.pOSTable.findMany({
      where: {
        businessId,
        branchId
      },
      orderBy: [{ status: "asc" }, { name: "asc" }]
    }),
    getOpenOrders({ businessId, branchId })
  ]);

  return tables
    .map((table) => ({
      ...table,
      order: openOrders.find((order) => order.tableId === table.id) || null
    }))
    .sort((first, second) => {
      const firstWeight = first.order ? (first.order.status === "BILL_PRINTED" ? 0 : 1) : 2;
      const secondWeight = second.order ? (second.order.status === "BILL_PRINTED" ? 0 : 1) : 2;
      return firstWeight - secondWeight || first.name.localeCompare(second.name);
    });
}

function getOpenOrders({ businessId, branchId }) {
  return prisma.pOSOrder.findMany({
    where: {
      businessId,
      branchId,
      status: {
        in: activeOrderStatuses
      }
    },
    include: {
      table: {
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
          name: true
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 100
  });
}
