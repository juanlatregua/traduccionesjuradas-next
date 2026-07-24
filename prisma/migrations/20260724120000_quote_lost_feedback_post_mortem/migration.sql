-- CreateEnum
CREATE TYPE "QuoteLostReason" AS ENUM ('PRICE', 'DEADLINE', 'NO_LONGER_NEEDED', 'SOLVED_ELSEWHERE', 'OTHER');

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "lostFeedbackAt" TIMESTAMP(3),
ADD COLUMN     "lostReason" "QuoteLostReason",
ADD COLUMN     "lostReasonNote" TEXT,
ADD COLUMN     "postMortemJson" JSONB;

-- AlterTable (revisión guardián: instante real de expiración para la ventana del digest)
ALTER TABLE "Quote" ADD COLUMN     "expiredAt" TIMESTAMP(3);
