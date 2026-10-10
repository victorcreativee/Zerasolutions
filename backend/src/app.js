import { notificationRouter } from "./modules/notifications/notification.routes.js";
import { purchasingRouter } from "./modules/purchasing/purchasing.routes.js";
import { installationRouter } from './modules/installations/installation.routes.js';
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { prisma } from './config/prisma.js';
import { authRouter } from "./modules/auth/auth.routes.js";
import { businessRouter } from "./modules/businesses/business.routes.js";
import { branchRouter } from "./modules/branches/branch.routes.js";
import { customerRouter } from "./modules/customers/customer.routes.js";
import { payrollRouter } from "./modules/finance/payroll.routes.js";
import { financeRouter } from "./modules/finance/finance.routes.js";
import { moneyRouter } from "./modules/finance/money.routes.js";
import { userRouter } from "./modules/users/user.routes.js";
import { roleRouter } from "./modules/roles/role.routes.js";
import { inventoryRouter } from "./modules/inventory/inventory.routes.js";
import { moduleRouter } from "./modules/modules/module.routes.js";
import { operationsRouter } from "./modules/operations/operations.routes.js";
import { posRouter } from "./modules/pos/pos.routes.js";
import { productRouter } from "./modules/products/product.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { syncRouter } from "./modules/sync/sync.routes.js";
import { systemAdminRouter } from "./modules/systemAdmin/systemAdmin.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();
if (process.env.ZERA_TRUST_PROXY_HOPS === '1') app.set('trust proxy',1);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (env.nodeEnv === "development") {
        callback(null, true);
        return;
      }

      if (env.frontendUrls.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'X-Installer-SHA256']
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "zera-solutions-api",
    health: "/health",
    apiBase: "/api"
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "zera-solutions-api" });
});
app.get('/ready', async (_req,res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({status:'ok'}); }
  catch { res.status(503).json({status:'unavailable'}); }
});

app.use("/api/auth", authRouter);
app.use("/api/notifications", notificationRouter);
app.use('/api/installations', installationRouter);
app.use("/api/businesses", businessRouter);
app.use("/api/branches", branchRouter);
app.use("/api/customers", customerRouter);
app.use("/api/finance", financeRouter);
app.use("/api/payroll", payrollRouter);
app.use("/api/users", userRouter);
app.use("/api/roles", roleRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/modules", moduleRouter);
app.use("/api/operations", operationsRouter);
app.use("/api/pos", posRouter);
app.use("/api/products", productRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/sync", syncRouter);
app.use("/api/system-admin", systemAdminRouter);

app.use("/api/purchasing", purchasingRouter);
app.use("/api/money", moneyRouter);

app.use(notFoundHandler);
app.use(errorHandler);
