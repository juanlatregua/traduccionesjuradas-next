-- Consentimiento SEPARADO para el envío del presupuesto por email y su
-- recordatorio. El gdprConsent existente solo cubre el tratamiento de los
-- DOCUMENTOS para generar el presupuesto: no ampara enviar correo.
-- LSSI art. 21.1 exige autorización expresa y previa para el correo comercial
-- (su excepción del 21.2 pide relación contractual previa, y un lead que nunca
-- compró no la tiene). El cron de recordatorios filtra por este campo.
--
-- Aplicada a producción vía `prisma db push` el 17-jul-2026; se registra aquí
-- para que el historial de migraciones no diverja del schema.
ALTER TABLE "DocumentAnalysis" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DocumentAnalysis" ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3);
