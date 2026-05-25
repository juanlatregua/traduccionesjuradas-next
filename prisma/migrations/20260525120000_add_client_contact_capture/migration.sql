-- Captura de contacto en la puerta (v2): teléfono + email del cliente.
-- Aditivo y nullable: compatible hacia atrás, sin backfill.

ALTER TABLE "Order" ADD COLUMN "clientPhone" TEXT;

ALTER TABLE "OrderSession" ADD COLUMN "clientEmail" TEXT;
ALTER TABLE "OrderSession" ADD COLUMN "clientPhone" TEXT;
