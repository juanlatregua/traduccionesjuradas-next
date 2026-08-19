-- Bandeja de entrada (Microsoft Graph) + respuestas desde el admin.
-- Aditivo, sin perdida de datos.

ALTER TYPE "QuoteMessageType" ADD VALUE IF NOT EXISTS 'INBOX_REPLY';

CREATE TYPE "InboundEmailStatus" AS ENUM ('NEW', 'DRAFTED', 'REPLIED', 'ARCHIVED');

CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "internetMessageId" TEXT,
    "conversationId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "subject" TEXT NOT NULL,
    "bodyPreview" TEXT NOT NULL,
    "bodyText" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "InboundEmailStatus" NOT NULL DEFAULT 'NEW',
    "customerId" TEXT,
    "quoteId" TEXT,
    "orderReference" TEXT,
    "draftSubject" TEXT,
    "draftBody" TEXT,
    "draftedAt" TIMESTAMP(3),
    "replySubject" TEXT,
    "replyBody" TEXT,
    "repliedAt" TIMESTAMP(3),
    "repliedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboundEmail_graphId_key" ON "InboundEmail"("graphId");
CREATE INDEX "InboundEmail_status_receivedAt_idx" ON "InboundEmail"("status", "receivedAt");
CREATE INDEX "InboundEmail_fromEmail_idx" ON "InboundEmail"("fromEmail");
