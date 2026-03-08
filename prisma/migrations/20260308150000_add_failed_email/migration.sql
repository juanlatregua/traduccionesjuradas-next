-- CreateTable
CREATE TABLE "FailedEmail" (
    "id" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FailedEmail_pkey" PRIMARY KEY ("id")
);
