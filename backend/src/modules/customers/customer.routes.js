import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { getBusinessAccess } from "../../utils/businessAccess.js";
import { HttpError } from "../../utils/httpError.js";
import { enqueueSyncOperation } from "../../utils/syncQueue.js";

export const customerRouter = Router();

customerRouter.use(requireAuth);

function normalizeOptional(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

customerRouter.get("/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { q = "", status } = req.query;
    await getBusinessAccess(req.user, businessId);

    if (status && !["ACTIVE", "INACTIVE"].includes(status)) {
      throw new HttpError(400, "Customer status must be ACTIVE or INACTIVE.");
    }

    const search = q.trim();
    const customers = await prisma.customer.findMany({
      where: {
        businessId,
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { notes: { contains: search, mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ status: "asc" }, { name: "asc" }]
    });

    res.json({ customers });
  } catch (error) {
    next(error);
  }
});

customerRouter.get("/business/:businessId/:customerId/summary", async (req, res, next) => {
  try {
    const { businessId, customerId } = req.params;

    await getBusinessAccess(req.user, businessId);

    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId
      }
    });

    if (!customer) {
      throw new HttpError(404, "Customer was not found.");
    }

    const [salesAggregate, recentSales] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          businessId,
          customerId,
          status: "COMPLETED"
        },
        _count: {
          _all: true
        },
        _sum: {
          total: true
        }
      }),
      prisma.sale.findMany({
        where: {
          businessId,
          customerId
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
        orderBy: {
          createdAt: "desc"
        },
        take: 12
      })
    ]);

    res.json({
      customer: {
        ...customer,
        summary: {
          receiptCount: salesAggregate._count._all,
          totalSpent: Number(salesAggregate._sum.total || 0),
          lastSaleAt: recentSales[0]?.createdAt || null
        },
        recentSales
      }
    });
  } catch (error) {
    next(error);
  }
});

customerRouter.post("/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { email, name, notes, phone } = req.body;

    if (!name) {
      throw new HttpError(400, "Customer name is required.");
    }

    const { membership } = await getBusinessAccess(req.user, businessId);
    const canManageCustomers =
      req.user.systemRole === "SYSTEM_ADMIN" ||
      ["Owner", "Manager", "Cashier", "Waiter", "Store Keeper", "Pharmacist", "Front Desk"].includes(membership?.role?.name);

    if (!canManageCustomers) {
      throw new HttpError(403, "You do not have access to create customers.");
    }

    const customer = await prisma.customer.create({
      data: {
        businessId,
        name: name.trim(),
        phone: normalizeOptional(phone),
        email: normalizeOptional(email),
        notes: normalizeOptional(notes)
      }
    });

    await enqueueSyncOperation({
      businessId,
      entityType: "customer",
      entityId: customer.id,
      operation: "create",
      method: "POST",
      endpoint: `/api/customers/business/${businessId}`,
      payload: {
        localId: customer.id,
        email,
        name,
        notes,
        phone
      },
      userId: req.user.id
    });

    res.status(201).json({ customer });
  } catch (error) {
    if (error.code === "P2002") {
      next(new HttpError(409, "Customer phone or email already exists for this business."));
      return;
    }

    next(error);
  }
});

customerRouter.patch("/business/:businessId/:customerId", async (req, res, next) => {
  try {
    const { businessId, customerId } = req.params;
    const { email, name, notes, phone } = req.body;

    if (!name) {
      throw new HttpError(400, "Customer name is required.");
    }

    const { membership } = await getBusinessAccess(req.user, businessId);
    const canManageCustomers =
      req.user.systemRole === "SYSTEM_ADMIN" ||
      ["Owner", "Manager", "Cashier", "Waiter", "Store Keeper", "Pharmacist", "Front Desk"].includes(membership?.role?.name);

    if (!canManageCustomers) {
      throw new HttpError(403, "You do not have access to update customers.");
    }

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId
      }
    });

    if (!existingCustomer) {
      throw new HttpError(404, "Customer was not found.");
    }

    const customer = await prisma.customer.update({
      where: { id: existingCustomer.id },
      data: {
        name: name.trim(),
        phone: normalizeOptional(phone),
        email: normalizeOptional(email),
        notes: normalizeOptional(notes)
      }
    });

    await enqueueSyncOperation({
      businessId,
      entityType: "customer",
      entityId: customer.id,
      operation: "update",
      method: "PATCH",
      endpoint: `/api/customers/business/${businessId}/${customerId}`,
      payload: {
        localId: customer.id,
        email,
        name,
        notes,
        phone
      },
      userId: req.user.id
    });

    res.json({ customer });
  } catch (error) {
    if (error.code === "P2002") {
      next(new HttpError(409, "Customer phone or email already exists for this business."));
      return;
    }

    next(error);
  }
});

customerRouter.patch("/business/:businessId/:customerId/status", async (req, res, next) => {
  try {
    const { businessId, customerId } = req.params;
    const { status } = req.body;

    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      throw new HttpError(400, "Customer status must be ACTIVE or INACTIVE.");
    }

    const { membership } = await getBusinessAccess(req.user, businessId);
    const canManageCustomers = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager"].includes(membership?.role?.name);

    if (!canManageCustomers) {
      throw new HttpError(403, "Only the business owner or manager can update customer status.");
    }

    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        businessId
      }
    });

    if (!existingCustomer) {
      throw new HttpError(404, "Customer was not found.");
    }

    const customer = await prisma.customer.update({
      where: { id: existingCustomer.id },
      data: { status }
    });

    await enqueueSyncOperation({
      businessId,
      entityType: "customer",
      entityId: customer.id,
      operation: "status",
      method: "PATCH",
      endpoint: `/api/customers/business/${businessId}/${customerId}/status`,
      payload: {
        localId: customer.id,
        status
      },
      userId: req.user.id
    });

    res.json({ customer });
  } catch (error) {
    next(error);
  }
});
