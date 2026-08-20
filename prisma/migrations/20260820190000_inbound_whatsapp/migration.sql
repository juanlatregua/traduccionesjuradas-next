-- Bandeja unificada: WhatsApp (Twilio) junto al email. Aditivo.

CREATE TYPE "InboundChannel" AS ENUM ('EMAIL', 'WHATSAPP');

ALTER TABLE "InboundEmail" ADD COLUMN "channel" "InboundChannel" NOT NULL DEFAULT 'EMAIL';
ALTER TABLE "InboundEmail" ADD COLUMN "fromPhone" TEXT;
ALTER TABLE "InboundEmail" ADD COLUMN "mediaJson" JSONB;

CREATE INDEX "InboundEmail_fromPhone_idx" ON "InboundEmail"("fromPhone");
