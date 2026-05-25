-- Origen de captación del análisis (preset ?p=… de la puerta: uge-ce, etc.).
-- Aditivo y nullable: compatible hacia atrás.

ALTER TABLE "DocumentAnalysis" ADD COLUMN "source" TEXT;
