-- CreateTable
CREATE TABLE IF NOT EXISTS "ContadorTrabajo" (
    "id" TEXT NOT NULL,
    "documentAnalysisId" TEXT NOT NULL,
    "jobId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente_envio',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "paginasHechas" INTEGER,
    "paginasTotal" INTEGER,
    "palabrasTotal" INTEGER,
    "palabrasPorPagina" INTEGER[],
    "paginasSinTexto" INTEGER[],
    "idiomaDetectado" TEXT,
    "motivoError" TEXT,
    "palabrasHaiku" INTEGER,
    "aplicadoAt" TIMESTAMP(3),
    "abandonadoAt" TIMESTAMP(3),
    "avisoJson" JSONB,
    "avisoQuoteIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContadorTrabajo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContadorTrabajo_documentAnalysisId_key" ON "ContadorTrabajo"("documentAnalysisId");
CREATE UNIQUE INDEX IF NOT EXISTS "ContadorTrabajo_jobId_key" ON "ContadorTrabajo"("jobId");
CREATE INDEX IF NOT EXISTS "ContadorTrabajo_estado_createdAt_idx" ON "ContadorTrabajo"("estado", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ContadorTrabajo" ADD CONSTRAINT "ContadorTrabajo_documentAnalysisId_fkey" FOREIGN KEY ("documentAnalysisId") REFERENCES "DocumentAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
