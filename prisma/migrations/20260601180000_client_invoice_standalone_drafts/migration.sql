-- ClientInvoice: facturas autónomas (sin pedido) + borrador editable.
-- Aditivo y no destructivo: columnas nuevas, relajar NOT NULL, índice de estado.
ALTER TABLE "ClientInvoice" ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "concept" TEXT,
ADD COLUMN     "langPair" TEXT,
ADD COLUMN     "lineItemsJson" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "number" DROP NOT NULL,
ALTER COLUMN "orderId" DROP NOT NULL,
ALTER COLUMN "issuedAt" DROP NOT NULL,
ALTER COLUMN "issuedAt" DROP DEFAULT,
ALTER COLUMN "nif" DROP NOT NULL,
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "city" DROP NOT NULL,
ALTER COLUMN "postalCode" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ClientInvoice_status_idx" ON "ClientInvoice"("status");

-- Backfill: las facturas existentes (con número) ya estaban emitidas.
UPDATE "ClientInvoice" SET "status" = 'ISSUED' WHERE "number" IS NOT NULL;
