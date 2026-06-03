import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";

export const roleRouter = Router();

roleRouter.use(requireAuth);

roleRouter.get("/", (_req, res) => {
  res.json({
    roles: [
      { name: "Owner", description: "Full business access." },
      { name: "Manager", description: "Manage daily operations." },
      { name: "Cashier", description: "Serve customers and run POS." }
    ]
  });
});
