-- VeriFactu (RD 1007/2023, Orden HAC/1177/2024): registros de facturación
-- encadenados por huella SHA-256, registro de eventos e inmutabilidad. Aditivo.
ALTER TABLE "ClientInvoice" ADD COLUMN "emitterNif" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN "invoiceType" TEXT NOT NULL DEFAULT 'F1';
ALTER TABLE "ClientInvoice" ADD COLUMN "rectifiesId" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN "rectifiesNumber" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN "annulledAt" TIMESTAMP(3);
CREATE INDEX "ClientInvoice_rectifiesId_idx" ON "ClientInvoice"("rectifiesId");

CREATE TABLE "InvoiceRecord" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "emitterNif" TEXT NOT NULL,
  "chainIndex" INTEGER NOT NULL,
  "numSerie" TEXT NOT NULL,
  "issueDate" TEXT NOT NULL,
  "invoiceType" TEXT NOT NULL,
  "cuotaTotalCents" INTEGER NOT NULL,
  "importeTotalCents" INTEGER NOT NULL,
  "prevHash" TEXT,
  "hash" TEXT NOT NULL,
  "canonical" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "generatedAtIso" TEXT NOT NULL,
  "sendStatus" TEXT NOT NULL DEFAULT 'LOCAL',
  "provider" TEXT,
  "providerRef" TEXT,
  "providerResponse" JSONB,
  "sentAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoiceRecord_hash_key" ON "InvoiceRecord"("hash");
CREATE UNIQUE INDEX "InvoiceRecord_emitterNif_chainIndex_key" ON "InvoiceRecord"("emitterNif", "chainIndex");
CREATE INDEX "InvoiceRecord_invoiceId_idx" ON "InvoiceRecord"("invoiceId");
CREATE INDEX "InvoiceRecord_sendStatus_idx" ON "InvoiceRecord"("sendStatus");
ALTER TABLE "InvoiceRecord" ADD CONSTRAINT "InvoiceRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InvoiceEvent" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT,
  "type" TEXT NOT NULL,
  "actor" TEXT,
  "message" TEXT,
  "payload" JSONB,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvoiceEvent_invoiceId_idx" ON "InvoiceEvent"("invoiceId");
CREATE INDEX "InvoiceEvent_type_idx" ON "InvoiceEvent"("type");
CREATE INDEX "InvoiceEvent_at_idx" ON "InvoiceEvent"("at");
ALTER TABLE "InvoiceEvent" ADD CONSTRAINT "InvoiceEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
