-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'SERVICE', 'FEE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" TEXT,
ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
ADD COLUMN     "unit" TEXT;
