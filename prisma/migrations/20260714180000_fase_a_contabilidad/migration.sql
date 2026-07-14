-- Fase A contabilidad (PR #176) — aplicado vía prisma db push el 14-jul-2026.
-- Registro manual para el historial (migrate resolve --applied).

-- Expense: tratamiento fiscal estructurado + estado de revisión de recurrentes
ALTER TABLE "Expense" ADD COLUMN "taxTreatment" TEXT NOT NULL DEFAULT 'general';
ALTER TABLE "Expense" ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Expense_supplierNif_supplierInvoiceNumber_idx" ON "Expense"("supplierNif", "supplierInvoiceNumber");

-- Plantillas de gastos recurrentes
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "brand" TEXT NOT NULL DEFAULT 'traduccionesjuradas',
    "supplier" TEXT,
    "supplierNif" TEXT,
    "category" TEXT,
    "conceptTemplate" TEXT NOT NULL,
    "lineItemsJson" JSONB,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.21,
    "taxTreatment" TEXT NOT NULL DEFAULT 'general',
    "irpfRetentionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountCents" INTEGER,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "lastGeneratedPeriod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RecurringExpense_active_idx" ON "RecurringExpense"("active");

-- ClientInvoice: borrar un pedido no arrastra la factura (documento fiscal)
ALTER TABLE "ClientInvoice" DROP CONSTRAINT "ClientInvoice_orderId_fkey";
ALTER TABLE "ClientInvoice" ADD CONSTRAINT "ClientInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
