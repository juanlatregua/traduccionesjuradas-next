-- Add error tracking to ChatSession (PR feat/chat-error-tracking)
ALTER TABLE "ChatSession" ADD COLUMN "lastError" JSONB;
ALTER TABLE "ChatSession" ADD COLUMN "errorCount" INTEGER NOT NULL DEFAULT 0;
