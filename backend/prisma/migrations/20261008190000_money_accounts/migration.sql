-- CreateTable
CREATE TABLE "MoneyAccount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyPosting" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT NOT NULL,
    "recordedById" TEXT NOT NULL,
    "reversesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyEntry" (
    "id" TEXT NOT NULL,
    "postingId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "MoneyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoneyAccount_businessId_idx" ON "MoneyAccount"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyAccount_branchId_code_key" ON "MoneyAccount"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyPosting_reversesId_key" ON "MoneyPosting"("reversesId");

-- CreateIndex
CREATE INDEX "MoneyPosting_businessId_branchId_createdAt_idx" ON "MoneyPosting"("businessId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "MoneyPosting_businessId_kind_sourceId_idx" ON "MoneyPosting"("businessId", "kind", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyPosting_businessId_requestKey_key" ON "MoneyPosting"("businessId", "requestKey");

-- CreateIndex
CREATE INDEX "MoneyEntry_accountId_idx" ON "MoneyEntry"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyEntry_postingId_accountId_key" ON "MoneyEntry"("postingId", "accountId");

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyAccount" ADD CONSTRAINT "MoneyAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyPosting" ADD CONSTRAINT "MoneyPosting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyPosting" ADD CONSTRAINT "MoneyPosting_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyEntry" ADD CONSTRAINT "MoneyEntry_postingId_fkey" FOREIGN KEY ("postingId") REFERENCES "MoneyPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyEntry" ADD CONSTRAINT "MoneyEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

