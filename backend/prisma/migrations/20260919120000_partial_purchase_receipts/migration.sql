-- AlterEnum
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'PARTIALLY_RECEIVED';

-- AlterTable
ALTER TABLE "StockAdjustment" ADD COLUMN     "purchaseReceiptId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ADD COLUMN     "receivedQuantity" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "receivedById" TEXT,
    "requestKey" TEXT,
    "requestHash" TEXT,
    "note" TEXT,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_reference_key" ON "PurchaseReceipt"("reference");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_orderId_createdAt_idx" ON "PurchaseReceipt"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceipt_orderId_requestKey_key" ON "PurchaseReceipt"("orderId", "requestKey");

-- CreateIndex
CREATE INDEX "StockAdjustment_purchaseReceiptId_idx" ON "StockAdjustment"("purchaseReceiptId");

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve completed deliveries recorded before per-delivery history existed.
UPDATE "PurchaseOrderItem" AS item
SET "receivedQuantity" = item."quantity"
FROM "PurchaseOrder" AS purchase
WHERE item."orderId" = purchase."id" AND purchase."status" = 'RECEIVED';

INSERT INTO "PurchaseReceipt" ("id", "reference", "orderId", "receivedById", "note", "items", "createdAt")
SELECT 'legacy-' || purchase."id", 'PR-LEGACY-' || purchase."id", purchase."id", purchase."receivedById",
       'Historical full delivery imported when receipt history was introduced.',
       COALESCE(jsonb_agg(jsonb_build_object('orderItemId', item."id", 'productId', item."productId", 'productName', item."productName", 'quantity', item."quantity", 'unitCost', item."unitCost"::text)) FILTER (WHERE item."id" IS NOT NULL), '[]'::jsonb),
       COALESCE(purchase."receivedAt", purchase."updatedAt")
FROM "PurchaseOrder" AS purchase
LEFT JOIN "PurchaseOrderItem" AS item ON item."orderId" = purchase."id"
WHERE purchase."status" = 'RECEIVED'
GROUP BY purchase."id";

UPDATE "StockAdjustment" AS movement
SET "purchaseReceiptId" = 'legacy-' || purchase."id"
FROM "PurchaseOrder" AS purchase
WHERE purchase."status" = 'RECEIVED' AND movement."businessId" = purchase."businessId"
  AND movement."note" = 'Purchase ' || purchase."number" AND movement."type" = 'INCREASE';

ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_receivedQuantity_check"
CHECK ("receivedQuantity" >= 0 AND "receivedQuantity" <= "quantity");
