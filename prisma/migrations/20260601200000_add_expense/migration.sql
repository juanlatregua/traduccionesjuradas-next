-- Gastos manuales del libro de contabilidad (IVA soportado). Tabla nueva, aditivo.
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'traduccionesjuradas',
    "supplier" TEXT,
    "supplierNif" TEXT,
    "concept" TEXT NOT NULL,
    "category" TEXT,
    "baseCents" INTEGER NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0.21,
    "vatCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_date_idx" ON "Expense"("date");
