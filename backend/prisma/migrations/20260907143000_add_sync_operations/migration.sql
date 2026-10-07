CREATE TABLE "SyncOperation" (
  "id" TEXT NOT NULL,
  "businessId" TEXT,
  "branchId" TEXT,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "operation" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "payload" JSONB,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "source" TEXT NOT NULL DEFAULT 'desktop',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3),
  "syncedAt" TIMESTAMP(3),
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SyncOperation_businessId_idx" ON "SyncOperation"("businessId");
CREATE INDEX "SyncOperation_branchId_idx" ON "SyncOperation"("branchId");
CREATE INDEX "SyncOperation_status_idx" ON "SyncOperation"("status");
CREATE INDEX "SyncOperation_entityType_idx" ON "SyncOperation"("entityType");
CREATE INDEX "SyncOperation_createdAt_idx" ON "SyncOperation"("createdAt");
