-- Soft-link de DocumentAnalysis a la OrderSession/Order de la puerta por
-- referencia, para fijar orderId cuando el Order nace en el webhook de pago.
-- Aditivo y nullable: compatible hacia atrás.

ALTER TABLE "DocumentAnalysis" ADD COLUMN "orderReference" TEXT;

CREATE INDEX "DocumentAnalysis_orderReference_idx" ON "DocumentAnalysis"("orderReference");
