CREATE TABLE "InstallationEnrollment" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
 "codeHash" TEXT NOT NULL UNIQUE, "expiresAt" TIMESTAMP(3) NOT NULL,
 "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Installation" (
 "id" TEXT PRIMARY KEY, "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
 "enrollmentId" TEXT NOT NULL UNIQUE REFERENCES "InstallationEnrollment"("id"),
 "tokenHash" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL, "platform" TEXT NOT NULL,
 "architecture" TEXT NOT NULL, "appVersion" TEXT NOT NULL, "mode" TEXT NOT NULL DEFAULT 'DESKTOP',
 "healthy" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSeenAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3)
);
CREATE INDEX "Installation_businessId_createdAt_idx" ON "Installation"("businessId", "createdAt");
