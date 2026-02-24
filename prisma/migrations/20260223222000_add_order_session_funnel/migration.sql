CREATE TYPE "SessionStep" AS ENUM (
  'START',
  'UPLOAD',
  'REVIEW',
  'CHECKOUT',
  'CONFIRMATION'
);

CREATE TYPE "AuthState" AS ENUM (
  'GUEST',
  'AUTHENTICATED'
);

CREATE TABLE "OrderSession" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "step" "SessionStep" NOT NULL DEFAULT 'UPLOAD',
  "purpose" TEXT,
  "authState" "AuthState" NOT NULL DEFAULT 'GUEST',
  "userId" TEXT,
  "subtotalCents" INTEGER NOT NULL DEFAULT 0,
  "vatCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "isPaid" BOOLEAN NOT NULL DEFAULT false,
  "paidAt" TIMESTAMP(3),
  "paymentMethod" TEXT,
  "reference" TEXT NOT NULL,
  CONSTRAINT "OrderSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderDocument" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "fileKey" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "detectedType" TEXT,
  "sourceLang" TEXT,
  "targetLang" TEXT DEFAULT 'es',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderSession_reference_key" ON "OrderSession"("reference");
CREATE INDEX "OrderSession_userId_idx" ON "OrderSession"("userId");
CREATE INDEX "OrderSession_step_updatedAt_idx" ON "OrderSession"("step", "updatedAt");
CREATE INDEX "OrderDocument_sessionId_createdAt_idx" ON "OrderDocument"("sessionId", "createdAt");

ALTER TABLE "OrderDocument"
  ADD CONSTRAINT "OrderDocument_sessionId_fkey"
  FOREIGN KEY ("sessionId")
  REFERENCES "OrderSession"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
