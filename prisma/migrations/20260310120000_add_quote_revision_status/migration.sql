-- AlterEnum
ALTER TYPE "AssignmentStatus" ADD VALUE 'QUOTE_REVISION_REQUESTED';

-- AlterTable
ALTER TABLE "CollaboratorAssignment" ADD COLUMN "revisionReason" TEXT;
