import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

const name = process.env.SYSTEM_ADMIN_NAME || "Zera System Admin";
const email = process.env.SYSTEM_ADMIN_EMAIL || "admin@zera.com";
const password = process.env.SYSTEM_ADMIN_PASSWORD || "password123";

if (password.length < 8) {
  throw new Error("SYSTEM_ADMIN_PASSWORD must be at least 8 characters.");
}

const passwordHash = await bcrypt.hash(password, 12);

const user = await prisma.user.upsert({
  where: { email: email.toLowerCase() },
  update: {
    name,
    passwordHash,
    systemRole: "SYSTEM_ADMIN",
    status: "ACTIVE"
  },
  create: {
    name,
    email: email.toLowerCase(),
    passwordHash,
    systemRole: "SYSTEM_ADMIN"
  }
});

console.log(`System admin ready: ${user.email}`);
console.log(`API environment loaded for port ${env.port}`);

await prisma.$disconnect();
