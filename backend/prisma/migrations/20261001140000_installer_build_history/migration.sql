CREATE TABLE "InstallerBuild" (
  "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL, "platform" TEXT NOT NULL,
  "architecture" TEXT NOT NULL, "appVersion" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "configHash" TEXT NOT NULL, "manifest" JSONB NOT NULL, "fileName" TEXT, "sha256" TEXT,
  "byteSize" INTEGER, "error" TEXT, "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "startedAt" TIMESTAMP(3), "finishedAt" TIMESTAMP(3),
  CONSTRAINT "InstallerBuild_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "InstallerBuild_businessId_createdAt_idx" ON "InstallerBuild"("businessId", "createdAt");
CREATE INDEX "InstallerBuild_status_createdAt_idx" ON "InstallerBuild"("status", "createdAt");
