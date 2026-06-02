-- Plantilla de factura recurrente. Tabla nueva, aditivo.
CREATE TABLE "RecurringInvoice" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "brand" TEXT NOT NULL DEFAULT 'traduccionesjuradas',
  "clientName" TEXT, "fiscalName" TEXT NOT NULL, "nif" TEXT, "address" TEXT,
  "city" TEXT, "postalCode" TEXT, "country" TEXT NOT NULL DEFAULT 'España', "email" TEXT,
  "conceptTemplate" TEXT, "poNumber" TEXT, "langPair" TEXT, "lineItemsJson" JSONB,
  "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.21,
  "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
  "lastGeneratedPeriod" TEXT, "lastGeneratedInvoiceId" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecurringInvoice_active_idx" ON "RecurringInvoice"("active");
