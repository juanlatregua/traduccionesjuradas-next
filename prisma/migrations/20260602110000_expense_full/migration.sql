-- Gastos completos: nº factura proveedor, IRPF, IVA deducible, payable, adjunto. Aditivo.
ALTER TABLE "Expense" ADD COLUMN "supplierInvoiceNumber" TEXT;
ALTER TABLE "Expense" ADD COLUMN "ivaDeducible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Expense" ADD COLUMN "irpfRetentionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Expense" ADD COLUMN "irpfCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Expense" ADD COLUMN "payableCents" INTEGER;
ALTER TABLE "Expense" ADD COLUMN "attachmentUrl" TEXT;
ALTER TABLE "Expense" ADD COLUMN "attachmentKey" TEXT;
ALTER TABLE "Expense" ADD COLUMN "attachmentName" TEXT;
CREATE INDEX "Expense_supplierNif_idx" ON "Expense"("supplierNif");
