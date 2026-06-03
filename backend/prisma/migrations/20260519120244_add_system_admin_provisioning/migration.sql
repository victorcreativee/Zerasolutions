-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('SYSTEM_ADMIN', 'BUSINESS_USER');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "type" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "systemRole" "SystemRole" NOT NULL DEFAULT 'BUSINESS_USER';
