import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { businessRouter } from "./modules/businesses/business.routes.js";
import { branchRouter } from "./modules/branches/branch.routes.js";
import { customerRouter } from "./modules/customers/customer.routes.js";
import { userRouter } from "./modules/users/user.routes.js";
import { roleRouter } from "./modules/roles/role.routes.js";
import { inventoryRouter } from "./modules/inventory/inventory.routes.js";
import { moduleRouter } from "./modules/modules/module.routes.js";
import { posRouter } from "./modules/pos/pos.routes.js";
import { productRouter } from "./modules/products/product.routes.js";
import { systemAdminRouter } from "./modules/systemAdmin/systemAdmin.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(
  cors({
    origin(origin, callback) {
      console.log("Request Origin:", origin);
      console.log("Allowed Origins:", env.frontendUrls);

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
    credentials: true
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

app.use("/api/auth", authRouter);
app.use("/api/businesses", businessRouter);
app.use("/api/branches", branchRouter);
app.use("/api/customers", customerRouter);
app.use("/api/users", userRouter);
app.use("/api/roles", roleRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/modules", moduleRouter);
app.use("/api/pos", posRouter);
app.use("/api/products", productRouter);
app.use("/api/system-admin", systemAdminRouter);

app.use(notFoundHandler);
app.use(errorHandler);
