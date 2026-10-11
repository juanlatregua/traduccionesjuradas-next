-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "casoId" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "casoId" TEXT,
ADD COLUMN     "liveCasoKey" TEXT,
ADD COLUMN     "supersededAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DocumentAnalysis" ADD COLUMN     "casoId" TEXT;

-- AlterTable
ALTER TABLE "LavoriPriceRequest" ADD COLUMN     "casoId" TEXT;

-- AlterTable
ALTER TABLE "InboundEmail" ADD COLUMN     "casoId" TEXT;

-- CreateTable
CREATE TABLE "Caso" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "identityKey" TEXT NOT NULL,
    "email" TEXT,
    "phone9" TEXT,
    "nombre" TEXT,
    "pares" TEXT[],
    "origen" TEXT NOT NULL,
    "esAgencia" BOOLEAN NOT NULL DEFAULT false,
    "dudoso" BOOLEAN NOT NULL DEFAULT false,
    "customerId" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Caso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasoEvento" (
    "id" TEXT NOT NULL,
    "casoId" TEXT,
    "tipo" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "actor" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Caso_ref_key" ON "Caso"("ref");

-- CreateIndex
CREATE INDEX "Caso_identityKey_estado_idx" ON "Caso"("identityKey", "estado");

-- CreateIndex
CREATE INDEX "Caso_email_idx" ON "Caso"("email");

-- CreateIndex
CREATE INDEX "Caso_phone9_idx" ON "Caso"("phone9");

-- CreateIndex
CREATE INDEX "Caso_estado_lastActivityAt_idx" ON "Caso"("estado", "lastActivityAt");

-- CreateIndex
CREATE INDEX "CasoEvento_tipo_createdAt_idx" ON "CasoEvento"("tipo", "createdAt");

-- CreateIndex
CREATE INDEX "CasoEvento_casoId_createdAt_idx" ON "CasoEvento"("casoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CasoEvento_casoId_tipo_dedupeKey_key" ON "CasoEvento"("casoId", "tipo", "dedupeKey");

-- CreateIndex
CREATE INDEX "Order_casoId_idx" ON "Order"("casoId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_liveCasoKey_key" ON "Quote"("liveCasoKey");

-- CreateIndex
CREATE INDEX "Quote_casoId_idx" ON "Quote"("casoId");

-- CreateIndex
CREATE INDEX "DocumentAnalysis_casoId_idx" ON "DocumentAnalysis"("casoId");

-- CreateIndex
CREATE INDEX "LavoriPriceRequest_casoId_idx" ON "LavoriPriceRequest"("casoId");

-- CreateIndex
CREATE INDEX "InboundEmail_casoId_idx" ON "InboundEmail"("casoId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAnalysis" ADD CONSTRAINT "DocumentAnalysis_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LavoriPriceRequest" ADD CONSTRAINT "LavoriPriceRequest_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Caso" ADD CONSTRAINT "Caso_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasoEvento" ADD CONSTRAINT "CasoEvento_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "Caso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

