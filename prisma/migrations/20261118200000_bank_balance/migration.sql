-- CreateTable
CREATE TABLE IF NOT EXISTS "BankBalance" (
    "id" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BankBalance_account_key" ON "BankBalance"("account");
