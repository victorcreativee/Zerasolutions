import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";

export const roleRouter = Router();

roleRouter.use(requireAuth);

roleRouter.get("/", (_req, res) => {
  res.json({
    roles: [
      { name: "Owner", description: "Full business setup, modules, and team access." },
      { name: "Manager", description: "Manage daily operations, staff, and branch oversight." },
      { name: "Cashier", description: "Receive payments and run checkout." },
      { name: "Waiter", description: "Take table orders for bar and restaurant businesses." },
      { name: "Store Keeper", description: "Support product and stock-facing retail work." },
      { name: "Pharmacist", description: "Serve pharmacy customers and record medicine sales." },
      { name: "Front Desk", description: "Serve guest-facing hotel workflows." }
    ]
  });
});
