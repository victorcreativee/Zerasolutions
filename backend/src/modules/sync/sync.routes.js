import { HttpError } from "../../utils/httpError.js";
import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { getBusinessAccess } from "../../utils/businessAccess.js";
import { getSyncStatus, listSyncOperations, prepareSyncRun } from "../../utils/syncQueue.js";

export const syncRouter = Router();

syncRouter.use(requireAuth);

syncRouter.get("/status", async (req, res, next) => {
  try {
    const { businessId } = req.query;

    await assertSyncAccess(req.user, businessId);

    const sync = await getSyncStatus({ businessId });

    res.json({ sync });
  } catch (error) {
    next(error);
  }
});

syncRouter.get("/operations", async (req, res, next) => {
  try {
    const { businessId, status } = req.query;

    await assertSyncAccess(req.user, businessId);

    const operations = await listSyncOperations({
      businessId,
      status: status ? String(status).toUpperCase() : undefined
    });

    res.json({ operations });
  } catch (error) {
    next(error);
  }
});

syncRouter.post("/prepare", async (req, res, next) => {
  try {
    const { businessId } = req.body || {};

    await assertSyncAccess(req.user, businessId);

    const sync = await prepareSyncRun({ businessId });

    res.json({ sync });
  } catch (error) {
    next(error);
  }
});

async function assertSyncAccess(user, businessId) {
  if (!businessId) {
    if (user.systemRole !== "SYSTEM_ADMIN") throw new HttpError(400, "Select a business to view sync status.");
    return;
  }
  if (typeof businessId !== "string") throw new HttpError(400, "Business ID must be a string.");
  const { roleName } = await getBusinessAccess(user, businessId);
  if (user.systemRole !== "SYSTEM_ADMIN" && roleName !== "Owner") throw new HttpError(403, "Only the business owner can inspect the sync queue.");
}
