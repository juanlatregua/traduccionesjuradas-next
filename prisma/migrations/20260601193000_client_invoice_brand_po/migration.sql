-- ClientInvoice: facturación multimarca + Purchase Order. Aditivo.
ALTER TABLE "ClientInvoice" ADD COLUMN     "brand" TEXT NOT NULL DEFAULT 'traduccionesjuradas',
ADD COLUMN     "poNumber" TEXT;
