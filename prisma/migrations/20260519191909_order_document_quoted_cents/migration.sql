-- Bloque 1.3 (v2 Fase 1): el precio del pricing-engine por documento.
-- Cuando todos los OrderDocument de una sesion tienen quotedCents, el
-- checkout suma estos en vez de aplicar el precio plano del funnel.
ALTER TABLE "OrderDocument" ADD COLUMN "quotedCents" INTEGER;
