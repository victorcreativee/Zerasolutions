import { prisma } from "../config/prisma.js";

await prisma.$transaction(async (tx) => {
  await tx.business.deleteMany({});
  await tx.user.deleteMany({
    where: {
      systemRole: {
        not: "SYSTEM_ADMIN"
      }
    }
  });
});

const systemAdmins = await prisma.user.findMany({
  where: { systemRole: "SYSTEM_ADMIN" },
  select: {
    email: true,
    name: true
  },
  orderBy: { createdAt: "asc" }
});

console.log("Development data reset.");
console.log(`System admins kept: ${systemAdmins.map((user) => user.email).join(", ") || "none"}`);

await prisma.$disconnect();
