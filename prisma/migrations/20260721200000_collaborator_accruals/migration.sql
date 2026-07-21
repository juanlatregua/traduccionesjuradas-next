-- Cuenta corriente por colaborador: los gastos auto-creados al adjudicar un
-- encargo pasan a ser DEVENGOS internos (isAccrual) pendientes de la factura
-- real del traductor (mensual o puntual). Al registrarla, los devengos se
-- sellan con settledById (la factura recibida que los absorbe).
--
-- Aplicada a producción vía `prisma db push` el 21-jul-2026; se registra aquí
-- para que el historial de migraciones no diverja del schema.
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "collaboratorId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "orderReference" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "isAccrual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "settledById" TEXT;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_collaboratorId_fkey"
  FOREIGN KEY ("collaboratorId") REFERENCES "Collaborator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_settledById_fkey"
  FOREIGN KEY ("settledById") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Expense_isAccrual_settledById_idx" ON "Expense"("isAccrual", "settledById");
CREATE INDEX IF NOT EXISTS "Expense_collaboratorId_idx" ON "Expense"("collaboratorId");
