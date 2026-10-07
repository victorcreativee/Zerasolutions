CREATE TABLE "CashCount" (
"id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE RESTRICT,
"branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
"recordedById" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
"requestKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "date" TEXT NOT NULL,
"periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL, "currency" TEXT NOT NULL,
"opening" DECIMAL(14,2) NOT NULL, "cashIn" DECIMAL(14,2) NOT NULL, "cashOut" DECIMAL(14,2) NOT NULL,
"cashSales" DECIMAL(14,2) NOT NULL, "expected" DECIMAL(14,2) NOT NULL, "counted" DECIMAL(14,2) NOT NULL,
"difference" DECIMAL(14,2) NOT NULL, "note" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CashCount_businessId_requestKey_key" ON "CashCount"("businessId","requestKey");
CREATE INDEX "CashCount_businessId_branchId_date_createdAt_idx" ON "CashCount"("businessId","branchId","date","createdAt");
