-- CreateEnum
CREATE TYPE "POSOrderStatus" AS ENUM ('OPEN', 'BILL_PRINTED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "POSOrderItemStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "POSOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "POSOrderStatus" NOT NULL DEFAULT 'OPEN',
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "waiterId" TEXT NOT NULL,
    "customerId" TEXT,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "POSOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "POSOrderItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "status" "POSOrderItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "POSOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "POSOrder_orderNumber_key" ON "POSOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "POSOrder_saleId_key" ON "POSOrder"("saleId");

-- CreateIndex
CREATE INDEX "POSOrder_businessId_idx" ON "POSOrder"("businessId");

-- CreateIndex
CREATE INDEX "POSOrder_branchId_idx" ON "POSOrder"("branchId");

-- CreateIndex
CREATE INDEX "POSOrder_tableId_idx" ON "POSOrder"("tableId");

-- CreateIndex
CREATE INDEX "POSOrder_waiterId_idx" ON "POSOrder"("waiterId");

-- CreateIndex
CREATE INDEX "POSOrder_customerId_idx" ON "POSOrder"("customerId");

-- CreateIndex
CREATE INDEX "POSOrder_status_idx" ON "POSOrder"("status");

-- CreateIndex
CREATE INDEX "POSOrderItem_orderId_idx" ON "POSOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "POSOrderItem_productId_idx" ON "POSOrderItem"("productId");

-- AddForeignKey
ALTER TABLE "POSOrder" ADD CONSTRAINT "POSOrder_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSOrder" ADD CONSTRAINT "POSOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSOrder" ADD CONSTRAINT "POSOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "POSTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSOrder" ADD CONSTRAINT "POSOrder_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSOrder" ADD CONSTRAINT "POSOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSOrder" ADD CONSTRAINT "POSOrder_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSOrderItem" ADD CONSTRAINT "POSOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "POSOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "POSOrderItem" ADD CONSTRAINT "POSOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
