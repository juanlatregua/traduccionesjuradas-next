-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "paymentFrozenAt" TIMESTAMP(3),
ADD COLUMN     "paymentFrozenReason" TEXT,
ADD COLUMN     "paymentFreezeKey" TEXT;
