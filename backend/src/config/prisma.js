import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const prismaClientPackage =
  process.env.ZERA_DESKTOP === "true" ? require("../../prisma-client") : require("@prisma/client");
const { PrismaClient } = prismaClientPackage;
export const Prisma = prismaClientPackage.Prisma;

export const prisma = new PrismaClient();
