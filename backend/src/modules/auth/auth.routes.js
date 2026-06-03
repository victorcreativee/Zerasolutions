import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../../config/prisma.js";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { HttpError } from "../../utils/httpError.js";
import { signAuthToken } from "../../utils/tokens.js";

export const authRouter = Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    systemRole: user.systemRole,
    status: user.status
  };
}

authRouter.post("/register", async (req, res, next) => {
  try {
    throw new HttpError(403, "Accounts are created by the Zera system admin or your business owner.");
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new HttpError(400, "Email and password are required.");
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      throw new HttpError(401, "Invalid email or password.");
    }

    if (user.status !== "ACTIVE") {
      throw new HttpError(403, "This account is inactive. Contact your business owner or Zera system admin.");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new HttpError(401, "Invalid email or password.");
    }

    res.json({
      user: publicUser(user),
      token: signAuthToken(user)
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/profile", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

authRouter.patch("/password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new HttpError(400, "Current password and new password are required.");
    }

    if (newPassword.length < 8) {
      throw new HttpError(400, "New password must be at least 8 characters.");
    }

    if (currentPassword === newPassword) {
      throw new HttpError(400, "New password must be different from the current password.");
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!user) {
      throw new HttpError(404, "User account was not found.");
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!passwordMatches) {
      throw new HttpError(401, "Current password is incorrect.");
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

    res.json({ message: "Password updated." });
  } catch (error) {
    next(error);
  }
});
