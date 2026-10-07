CREATE TABLE "StockRequest" (
"id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE RESTRICT,
"requestKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "response" JSONB NOT NULL,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "StockRequest_businessId_requestKey_key" ON "StockRequest"("businessId","requestKey");
