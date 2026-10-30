-- AlterTable
ALTER TABLE "OrderSession" ADD COLUMN IF NOT EXISTS "billingJson" JSONB;
