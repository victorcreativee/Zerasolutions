import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new HttpError(401, "Authentication token is required.");
    }

    const token = header.split(" ")[1];
    const payload = jwt.verify(token, env.jwtSecret);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true,
        status: true,
        memberships: {
          select: {
            businessId: true,
            role: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!user || user.status !== "ACTIVE") {
      throw new HttpError(401, "User account is not active.");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error.statusCode ? error : new HttpError(401, "Invalid or expired token."));
  }
}

export function requireSystemAdmin(req, _res, next) {
  if (req.user?.systemRole !== "SYSTEM_ADMIN") {
    next(new HttpError(403, "System admin access is required."));
    return;
  }

  next();
}
