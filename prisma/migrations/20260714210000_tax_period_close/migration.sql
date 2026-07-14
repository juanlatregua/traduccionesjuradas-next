-- P1 paquete gestoría — aplicado vía prisma db push el 14-jul-2026.
CREATE TABLE "TaxPeriodClose" (
    "period" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT NOT NULL,
    CONSTRAINT "TaxPeriodClose_pkey" PRIMARY KEY ("period")
);
-- Semilla del último trimestre presentado antes del feature (sustituye a la env LAST_303_CLOSE):
INSERT INTO "TaxPeriodClose" ("period", "closedBy") VALUES ('2026-T1', 'seed-deploy') ON CONFLICT DO NOTHING;
