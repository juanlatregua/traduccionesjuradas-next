-- Reconcilia el historial de migraciones con `prisma db push` (sesión 2026-06-29).
-- Estas columnas/índices YA están aplicados en producción vía db push; este SQL es
-- idempotente (IF NOT EXISTS) para entornos nuevos / `prisma migrate deploy` / CI.

-- Justificante bancario del pago + titulares de los certificados en la factura.
ALTER TABLE "ClientInvoice" ADD COLUMN IF NOT EXISTS "paymentProofUrl" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN IF NOT EXISTS "paymentProofKey" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN IF NOT EXISTS "paymentProofName" TEXT;
ALTER TABLE "ClientInvoice" ADD COLUMN IF NOT EXISTS "holderNames" TEXT;

-- Titulares de los certificados en el presupuesto.
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "holderNames" TEXT;

-- Intermediario que trae al cliente (autorrelación nullable de Customer).
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "intermediaryId" TEXT;
CREATE INDEX IF NOT EXISTS "Customer_intermediaryId_idx" ON "Customer"("intermediaryId");
DO $$ BEGIN
  ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_intermediaryId_fkey"
    FOREIGN KEY ("intermediaryId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
