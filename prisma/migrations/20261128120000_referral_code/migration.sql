-- CreateEnum
CREATE TYPE "ReferralRewardStatus" AS ENUM ('NONE', 'PENDING', 'EARNED', 'REDEEMED', 'VOID');

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerCustomerId" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerPhone" TEXT,
    "sourceOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "usedByCustomerId" TEXT,
    "usedByEmail" TEXT,
    "usedByPhone" TEXT,
    "usedOnQuoteId" TEXT,
    "usedOnOrderId" TEXT,
    "discountCents" INTEGER,
    "requestedDiscountCents" INTEGER,
    "floorClamped" BOOLEAN NOT NULL DEFAULT false,
    "floorNote" TEXT,
    "rewardStatus" "ReferralRewardStatus" NOT NULL DEFAULT 'NONE',
    "rewardEarnedAt" TIMESTAMP(3),
    "rewardRedeemedOnQuoteId" TEXT,
    "rewardRedeemedAt" TIMESTAMP(3),
    "rewardDiscountCents" INTEGER,
    "rewardVoidedAt" TIMESTAMP(3),
    "rewardVoidReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_sourceOrderId_key" ON "ReferralCode"("sourceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_usedByCustomerId_key" ON "ReferralCode"("usedByCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_usedOnQuoteId_key" ON "ReferralCode"("usedOnQuoteId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_usedOnOrderId_key" ON "ReferralCode"("usedOnOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_rewardRedeemedOnQuoteId_key" ON "ReferralCode"("rewardRedeemedOnQuoteId");

-- CreateIndex
CREATE INDEX "ReferralCode_ownerCustomerId_rewardStatus_idx" ON "ReferralCode"("ownerCustomerId", "rewardStatus");

-- CreateIndex
CREATE INDEX "ReferralCode_usedByEmail_idx" ON "ReferralCode"("usedByEmail");

-- CreateIndex
CREATE INDEX "ReferralCode_usedByPhone_idx" ON "ReferralCode"("usedByPhone");

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_ownerCustomerId_fkey" FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

