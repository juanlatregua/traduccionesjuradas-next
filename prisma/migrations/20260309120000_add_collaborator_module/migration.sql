-- CreateEnum
CREATE TYPE "CollaboratorSupplierType" AS ENUM ('AUTONOMO', 'EMPRESA');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('REQUESTED', 'QUOTED', 'ACCEPTED', 'REJECTED', 'DELIVERED');

-- CreateTable
CREATE TABLE "Collaborator" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "languages" TEXT[],
    "swornNumber" TEXT,
    "nif" TEXT,
    "address" TEXT,
    "companyName" TEXT,
    "supplierType" "CollaboratorSupplierType" NOT NULL DEFAULT 'AUTONOMO',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaboratorAssignment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "accessToken" TEXT NOT NULL,
    "adminNotes" TEXT,
    "quotedPriceCents" INTEGER,
    "quotedDeadline" TIMESTAMP(3),
    "quotedAt" TIMESTAMP(3),
    "collaboratorNotes" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "deliveredFileUrl" TEXT,
    "deliveredFileKey" TEXT,
    "deliveredFilename" TEXT,
    "deliveredMimeType" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaboratorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Collaborator_email_key" ON "Collaborator"("email");

-- CreateIndex
CREATE INDEX "Collaborator_active_idx" ON "Collaborator"("active");

-- CreateIndex
CREATE UNIQUE INDEX "CollaboratorAssignment_accessToken_key" ON "CollaboratorAssignment"("accessToken");

-- CreateIndex
CREATE INDEX "CollaboratorAssignment_accessToken_idx" ON "CollaboratorAssignment"("accessToken");

-- CreateIndex
CREATE INDEX "CollaboratorAssignment_orderId_status_idx" ON "CollaboratorAssignment"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CollaboratorAssignment_orderId_collaboratorId_key" ON "CollaboratorAssignment"("orderId", "collaboratorId");

-- AddForeignKey
ALTER TABLE "CollaboratorAssignment" ADD CONSTRAINT "CollaboratorAssignment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollaboratorAssignment" ADD CONSTRAINT "CollaboratorAssignment_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
