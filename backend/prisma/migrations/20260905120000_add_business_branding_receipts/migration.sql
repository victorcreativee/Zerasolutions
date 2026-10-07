-- AlterTable
ALTER TABLE "Business"
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "brandPrimaryColor" TEXT,
ADD COLUMN "brandSecondaryColor" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "receiptHeader" TEXT,
ADD COLUMN "receiptFooter" TEXT,
ADD COLUMN "taxName" TEXT NOT NULL DEFAULT 'VAT',
ADD COLUMN "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "taxEnabled" BOOLEAN NOT NULL DEFAULT false;
