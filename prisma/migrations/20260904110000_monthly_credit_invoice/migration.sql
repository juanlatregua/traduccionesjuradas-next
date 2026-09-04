-- Factura AGRUPADA del mes para clientes de credito (4-sep-2026). Aditivo.
ALTER TABLE "Customer" ADD COLUMN "billingCycle" TEXT NOT NULL DEFAULT 'PER_ORDER';
ALTER TABLE "ClientInvoice" ADD COLUMN "periodKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "monthlyInvoiceId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_monthlyInvoiceId_fkey" FOREIGN KEY ("monthlyInvoiceId") REFERENCES "ClientInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Order_monthlyInvoiceId_idx" ON "Order"("monthlyInvoiceId");
CREATE INDEX "ClientInvoice_email_periodKey_idx" ON "ClientInvoice"("email", "periodKey");
