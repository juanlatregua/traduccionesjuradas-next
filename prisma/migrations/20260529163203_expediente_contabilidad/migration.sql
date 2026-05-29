-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "expedienteRef" TEXT;

-- CreateTable
CREATE TABLE "OrderDocumentItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "documentType" TEXT,
    "sourceLang" TEXT,
    "targetLang" TEXT,
    "words" INTEGER,
    "quotedCents" INTEGER,
    "prodStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "deliveredFileUrl" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDocumentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fiscalName" TEXT NOT NULL,
    "nif" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'España',
    "email" TEXT NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.21,
    "vatCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderDocumentItem_orderId_idx" ON "OrderDocumentItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_number_key" ON "ClientInvoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvoice_orderId_key" ON "ClientInvoice"("orderId");

-- CreateIndex
CREATE INDEX "ClientInvoice_issuedAt_idx" ON "ClientInvoice"("issuedAt");

-- AddForeignKey
ALTER TABLE "OrderDocumentItem" ADD CONSTRAINT "OrderDocumentItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
