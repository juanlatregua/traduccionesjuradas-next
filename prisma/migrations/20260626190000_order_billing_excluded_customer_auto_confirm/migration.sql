-- Reconcilia el historial de migraciones con `prisma db push` (sesión 2026-06-26).
-- Estas columnas YA están aplicadas en producción vía db push; este SQL es
-- idempotente (IF NOT EXISTS) para entornos nuevos / `prisma migrate deploy`.

-- Excluir pedidos de la facturación oficial, con motivo (apartado reversible).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingExcluded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "billingExcludedReason" TEXT;

-- Cliente de confianza (B2B): el justificante auto-confirma el pago + emite factura.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "autoConfirmPayment" BOOLEAN NOT NULL DEFAULT false;
