ALTER TABLE "Sale" ADD COLUMN "requestKey" TEXT, ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "Sale_businessId_requestKey_key" ON "Sale"("businessId", "requestKey");
