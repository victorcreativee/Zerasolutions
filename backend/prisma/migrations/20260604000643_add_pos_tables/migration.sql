-- CreateEnum
CREATE TYPE "POSTableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'INACTIVE');

-- CreateTable
CREATE TABLE "POSTable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 4,
    "status" "POSTableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POSTable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "POSTable_businessId_idx" ON "POSTable"("businessId");

-- CreateIndex
CREATE INDEX "POSTable_branchId_idx" ON "POSTable"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "POSTable_businessId_branchId_name_key" ON "POSTable"("businessId", "branchId", "name");

-- AddForeignKey
ALTER TABLE "POSTable" ADD CONSTRAINT "POSTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSTable" ADD CONSTRAINT "POSTable_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
