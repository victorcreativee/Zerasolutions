-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "packageStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "platformBusinessTypeId" TEXT,
ADD COLUMN     "platformPackageId" TEXT;

-- CreateTable
CREATE TABLE "PlatformBusinessType" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "posMode" "POSMode" NOT NULL DEFAULT 'RETAIL_CHECKOUT',
    "helper" TEXT,
    "defaultTableCount" INTEGER,
    "defaultModuleKeys" JSONB NOT NULL,
    "roles" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformBusinessType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPackage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "maxBranches" INTEGER,
    "maxUsers" INTEGER,
    "maxProducts" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPackageModule" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "moduleKey" "ModuleKey" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPackageModule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformBusinessType_key_key" ON "PlatformBusinessType"("key");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformBusinessType_value_key" ON "PlatformBusinessType"("value");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPackage_key_key" ON "PlatformPackage"("key");

-- CreateIndex
CREATE INDEX "PlatformPackageModule_packageId_idx" ON "PlatformPackageModule"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPackageModule_packageId_moduleKey_key" ON "PlatformPackageModule"("packageId", "moduleKey");

-- CreateIndex
CREATE INDEX "Business_platformBusinessTypeId_idx" ON "Business"("platformBusinessTypeId");

-- CreateIndex
CREATE INDEX "Business_platformPackageId_idx" ON "Business"("platformPackageId");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_platformBusinessTypeId_fkey" FOREIGN KEY ("platformBusinessTypeId") REFERENCES "PlatformBusinessType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_platformPackageId_fkey" FOREIGN KEY ("platformPackageId") REFERENCES "PlatformPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPackageModule" ADD CONSTRAINT "PlatformPackageModule_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "PlatformPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
