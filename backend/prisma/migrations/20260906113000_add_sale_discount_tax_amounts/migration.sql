ALTER TABLE "Sale" ADD COLUMN "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "Sale"
SET "taxAmount" = GREATEST("total" - "subtotal", 0)
WHERE "taxAmount" = 0;
