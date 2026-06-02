-- ClientInvoice.simplified: factura simplificada (RD 1619/2012). Aditivo.
ALTER TABLE "ClientInvoice" ADD COLUMN "simplified" BOOLEAN NOT NULL DEFAULT false;
