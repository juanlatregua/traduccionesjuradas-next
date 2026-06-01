-- BankDecision: decisiones de conciliación bancaria (sin extracto crudo). Aditivo.
CREATE TABLE "BankDecision" (
  "id"          TEXT NOT NULL,
  "brand"       TEXT NOT NULL DEFAULT 'traduccionesjuradas',
  "lineHash"    TEXT NOT NULL,
  "status"      TEXT NOT NULL,
  "matchedType" TEXT,
  "matchedId"   TEXT,
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BankDecision_lineHash_key" ON "BankDecision"("lineHash");
CREATE INDEX "BankDecision_brand_idx" ON "BankDecision"("brand");
