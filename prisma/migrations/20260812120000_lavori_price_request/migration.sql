-- Solicitud de PRECIO a lavori para un LEAD (WhatsApp) sin pedido (12-ago-2026).
CREATE TABLE IF NOT EXISTS "LavoriPriceRequest" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "par" TEXT NOT NULL,
    "candidatos" TEXT[],
    "expedienteRef" TEXT,
    "customerHint" TEXT,
    "docsCount" INTEGER NOT NULL DEFAULT 0,
    "words" INTEGER,
    "encargoId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "priceCents" INTEGER,
    "plazoDias" INTEGER,
    "notas" TEXT,
    "miembroId" TEXT,
    "miembroNombre" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LavoriPriceRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LavoriPriceRequest_ref_key" ON "LavoriPriceRequest"("ref");
