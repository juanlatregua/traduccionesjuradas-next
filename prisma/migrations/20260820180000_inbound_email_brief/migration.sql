-- Lectura IA del email entrante (par, urgencia, documento provisional, notas,
-- preguntas) persistida para que el borrador de respuesta y el email del
-- presupuesto la incluyan solos. Aditivo, sin perdida de datos.

ALTER TABLE "InboundEmail" ADD COLUMN "briefJson" JSONB;
ALTER TABLE "InboundEmail" ADD COLUMN "briefAt" TIMESTAMP(3);
