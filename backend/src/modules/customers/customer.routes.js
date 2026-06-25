import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";

export const customerRouter = Router();

customerRouter.use(requireAuth);

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

function normalizeOptional(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

customerRouter.get("/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { q = "", status } = req.query;
    const membership = await getBusinessMembership(req.user.id, businessId);

    if (!membership && req.user.systemRole !== "SYSTEM_ADMIN") {
      throw new HttpError(403, "You do not have access to these customers.");
    }

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

customerRouter.post("/business/:businessId", async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { email, name, notes, phone } = req.body;

    if (!name) {
      throw new HttpError(400, "Customer name is required.");
    }

    const membership = await getBusinessMembership(req.user.id, businessId);
    const canManageCustomers = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager", "Cashier"].includes(membership?.role?.name);

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

    const membership = await getBusinessMembership(req.user.id, businessId);
    const canManageCustomers = req.user.systemRole === "SYSTEM_ADMIN" || ["Owner", "Manager", "Cashier"].includes(membership?.role?.name);

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

    const membership = await getBusinessMembership(req.user.id, businessId);
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

    res.json({ customer });
  } catch (error) {
    next(error);
  }
});
