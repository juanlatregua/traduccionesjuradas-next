-- Fase 2 puente lavori (contrato 12-ago-2026): vinculo presupuesto<->solicitud
-- de precio para el emisor precio_aceptado. Aditivo, sin perdida de datos.
ALTER TABLE "LavoriPriceRequest" ADD COLUMN "quoteId" TEXT;

CREATE INDEX "LavoriPriceRequest_quoteId_idx" ON "LavoriPriceRequest"("quoteId");

CREATE INDEX "LavoriPriceRequest_expedienteRef_idx" ON "LavoriPriceRequest"("expedienteRef");
