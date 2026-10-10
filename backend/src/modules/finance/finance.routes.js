import { buildDateFilter } from "../../utils/reportDates.js";
import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { getBusinessAccess } from "../../utils/businessAccess.js";
import { HttpError } from "../../utils/httpError.js";
import { enqueueSyncOperation } from "../../utils/syncQueue.js";
import { money } from "../../utils/productPricing.js";
import { decimal, fingerprint, lockMoney, paidAmount } from "../../utils/moneyLedger.js";

export const financeRouter = Router();

financeRouter.use(requireAuth);

const financeRoles = new Set(["Owner"]);
const paymentMethods = new Set(["CASH", "CARD", "MOBILE_MONEY"]);
const expenseStatuses = new Set(["PENDING", "APPROVED", "REJECTED"]);

financeRouter.get('/business/:businessId/cashflow',async(req,res,next)=>{try{
 const {businessId}=req.params;await assertFinanceAccess(req.user,businessId);
 const branchId=String(req.query.branchId||'');if(branchId&&!await prisma.branch.findFirst({where:{id:branchId,businessId}}))throw new HttpError(404,'Branch not found.');
 const createdAt=buildDateFilter(req.query),where={businessId,...(branchId?{branchId}:{}),...(createdAt?{createdAt}:{})};
 const result=await prisma.$transaction(async tx=>{
  const accounts=await tx.moneyAccount.findMany({where:{businessId,...(branchId?{branchId}:{}),kind:'ASSET'},include:{branch:{select:{name:true}}}});
  const balances=await tx.moneyEntry.groupBy({by:['accountId'],where:{accountId:{in:accounts.map(a=>a.id)}},_sum:{amount:true}});
  const movements=await tx.moneyPosting.groupBy({by:['kind'],where,_sum:{amount:true}});
  const branchCount=await tx.branch.count({where:{businessId,...(branchId?{id:branchId}:{})}});
  return {tracking:{branches:branchCount,tracked:new Set(accounts.map(a=>a.branchId)).size},accounts:accounts.map(a=>({id:a.id,name:a.name,code:a.code,branch:a.branch.name,balance:decimal(balances.find(b=>b.accountId===a.id)?._sum.amount).toFixed(2)})),movements:movements.map(m=>({kind:m.kind,amount:decimal(m._sum.amount).toFixed(2)}))};
 },{isolationLevel:'RepeatableRead'});res.json(result);
}catch(e){next(e);}});

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

financeRouter.get("/business/:businessId/expenses", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { roleName } = await assertFinanceAccess(req.user, businessId, { expensesOnly: true });
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const where = { businessId, ...(roleName === "Store Keeper" ? { recordedById: req.user.id } : {}) };
    if(req.query.status){if(!expenseStatuses.has(req.query.status))throw new HttpError(400,'Invalid expense status.');where.status=req.query.status;}
    if(req.query.search)where.OR=['title','category'].map(key=>({[key]:{contains:String(req.query.search).slice(0,200),mode:'insensitive'}}));
    const [expenses, total] = await prisma.$transaction([
      prisma.expense.findMany({ where, include: expenseInclude, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 10, take: 10 }),
      prisma.expense.count({ where })
    ]);
    const payments=await prisma.moneyPosting.groupBy({by:['sourceId'],where:{businessId,kind:'EXPENSE',sourceId:{in:expenses.map(e=>e.id)}},_sum:{amount:true}});
    res.json({ expenses:expenses.map(e=>({...e,paid:decimal(payments.find(p=>p.sourceId===e.id)?._sum.amount).toFixed(2)})), total, page });
  } catch (error) { next(error); }
});

financeRouter.post("/business/:businessId/expenses", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { amount, branchId, category = "General", note = "", title } = req.body;

    await assertFinanceAccess(req.user, businessId, { expensesOnly: true });

    if (typeof title!=="string" || !title.trim() || title.length>200 || typeof note!=="string" || note.length>2000 || typeof category!=="string" || category.length>200) {
      throw new HttpError(400, "Expense title is required.");
    }

    const normalizedAmount = Number(money(amount, "Expense amount"));

    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      throw new HttpError(400, "Expense amount must be greater than zero.");
    }

    if(typeof branchId!=="string"||!branchId)throw new HttpError(400,"Choose an active branch.");
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

    const requestKey=req.body.requestKey;
    if(requestKey!==undefined&&(typeof requestKey!=='string'||! /^[a-zA-Z0-9-]{16,80}$/.test(requestKey)))throw new HttpError(400,'Invalid submission reference.');
    const requestHash=fingerprint({title:title.trim(),amount:normalizedAmount,branchId,category,note,userId:req.user.id});
    let replayed=false;
    const expense = await prisma.$transaction(async tx => {
      if(requestKey){
        await lockMoney(tx,businessId);
        const prior=await tx.financeEvent.findFirst({where:{businessId,entityId:`request:${requestKey}`,action:'EXPENSE_REQUEST'}});
        if(prior){if(prior.details.hash!==requestHash)throw new HttpError(409,'This submission reference was used for a different expense.');replayed=true;return tx.expense.findUnique({where:{id:prior.details.expenseId},include:expenseInclude});}
      }
      const result = await tx.expense.create({
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

    if(requestKey)await tx.financeEvent.create({data:{businessId,entityId:`request:${requestKey}`,actorId:req.user.id,action:'EXPENSE_REQUEST',details:{hash:requestHash,expenseId:result.id}}});
    await tx.financeEvent.create({data:{businessId,entityId:result.id,actorId:req.user.id,action:'EXPENSE_CREATED',details:{amount:String(result.amount),title:result.title}}});return result;});

    if(!replayed)await enqueueSyncOperation({
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

    const expense = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Expense" WHERE id=${expenseId} AND "businessId"=${businessId} FOR UPDATE`;
      if (normalizedStatus !== "APPROVED" && (await paidAmount(tx,businessId,'EXPENSE',expenseId)).gt(0)) throw new HttpError(409,'This expense has recorded payments. Correct the payment before changing approval.');
      const before=await tx.expense.findUnique({where:{id:expenseId}});
      const updated=await tx.expense.update({
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
      await tx.financeEvent.create({data:{businessId,entityId:expenseId,actorId:req.user.id,action:'EXPENSE_STATUS',details:{before:before.status,after:normalizedStatus}}});return updated;
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

financeRouter.patch('/business/:businessId/expenses/:expenseId',async(req,res,next)=>{try{
 const {businessId,expenseId}=req.params;const {roleName}=await assertFinanceAccess(req.user,businessId,{expensesOnly:true});
 const {title,category,note='',amount}=req.body;
 if(typeof title!=='string'||!title.trim()||title.length>200||typeof category!=='string'||!category.trim()||category.length>200||typeof note!=='string'||note.length>2000)throw new HttpError(400,'Enter a title, category and valid note.');
 const value=money(amount,'Expense amount');if(Number(value)<=0)throw new HttpError(400,'Amount must be greater than zero.');
 const expense=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Expense" WHERE id=${expenseId} AND "businessId"=${businessId} FOR UPDATE`;
  const before=await tx.expense.findFirst({where:{id:expenseId,businessId}});
  if(!before||(roleName!=='Owner'&&before.recordedById!==req.user.id))throw new HttpError(404,'Expense not found.');
  if(before.status!=='PENDING'||(await paidAmount(tx,businessId,'EXPENSE',expenseId)).gt(0))throw new HttpError(409,'Only pending, unpaid expenses can be edited.');
  const result=await tx.expense.update({where:{id:expenseId},data:{title:title.trim(),category:category.trim(),note:note.trim()||null,amount:value},include:expenseInclude});
  await tx.financeEvent.create({data:{businessId,entityId:expenseId,actorId:req.user.id,action:'EXPENSE_EDITED',details:{before:{title:before.title,amount:String(before.amount),category:before.category,note:before.note},after:{title:result.title,amount:value,category:result.category,note:result.note}}}});return result;
 });res.json({expense});
}catch(e){next(e);}});
financeRouter.get('/business/:businessId/expenses/:expenseId/history',async(req,res,next)=>{try{
 const {businessId,expenseId}=req.params;const {roleName}=await assertFinanceAccess(req.user,businessId,{expensesOnly:true});
 if(!await prisma.expense.findFirst({where:{businessId,id:expenseId,...(roleName==='Store Keeper'?{recordedById:req.user.id}:{})}}))throw new HttpError(404,'Expense not found.');
 const events=await prisma.financeEvent.findMany({where:{businessId,entityId:expenseId},orderBy:{createdAt:'desc'}});
 const actors=await prisma.user.findMany({where:{id:{in:[...new Set(events.map(e=>e.actorId))]}},select:{id:true,name:true}});
 res.json({events:events.map(e=>({...e,actorName:actors.find(a=>a.id===e.actorId)?.name||'Former user'}))});
}catch(e){next(e);}});

const expenseInclude = {
  payrollEntry: {select:{period:true}},
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

async function assertFinanceAccess(user, businessId, { expensesOnly = false } = {}) {
  if (!prisma.expense) {
    throw new HttpError(503, "Prisma Client is out of date. Restart the backend and run npx prisma generate.");
  }

  const { business, roleName } = await getBusinessAccess(user, businessId);

  const retailExpenseAccess = expensesOnly && roleName === "Store Keeper" && business.features.typeKey === "RETAIL_SHOP";
  if (user.systemRole !== "SYSTEM_ADMIN" && !financeRoles.has(roleName) && !retailExpenseAccess) {
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
