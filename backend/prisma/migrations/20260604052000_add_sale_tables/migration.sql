-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "tableId" TEXT;

-- CreateIndex
CREATE INDEX "Sale_tableId_idx" ON "Sale"("tableId");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "POSTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
