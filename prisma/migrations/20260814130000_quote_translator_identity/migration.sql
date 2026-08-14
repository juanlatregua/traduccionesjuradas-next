-- Identidad del jurado en el presupuesto (directriz 12-ago: nombre + nº MAEC
-- en la cotizacion). Aditivo, sin perdida de datos.
ALTER TABLE "Quote" ADD COLUMN "translatorName" TEXT;
ALTER TABLE "Quote" ADD COLUMN "translatorMaec" TEXT;
