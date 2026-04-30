-- Add tool call tracking + attachment flag to ChatSession (PR-driven from feat/chat-tracking-and-ux)
ALTER TABLE "ChatSession" ADD COLUMN "toolCalls" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "ChatSession" ADD COLUMN "hasAttachment" BOOLEAN NOT NULL DEFAULT false;
