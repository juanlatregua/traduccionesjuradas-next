-- Quotes / Presupuestos module
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "QuoteStatus" AS ENUM (
  'DRAFT',
  'SENT',
  'OPENED',
  'ACCEPTED',
  'PAID',
  'IN_PROGRESS',
  'DELIVERED',
  'EXPIRED'
);

CREATE TYPE "QuoteDeliveryType" AS ENUM (
  'DIGITAL_PDF',
  'PAPER_SHIP'
);

CREATE TYPE "QuoteDiscountType" AS ENUM (
  'NONE',
  'PERCENT',
  'FIXED'
);

CREATE TYPE "QuotePaymentProvider" AS ENUM (
  'STRIPE',
  'PAYPAL',
  'BIZUM',
  'TRANSFER',
  'OTHER'
);

CREATE TYPE "QuoteMessageChannel" AS ENUM (
  'EMAIL',
  'WHATSAPP'
);

CREATE TYPE "QuoteMessageType" AS ENUM (
  'PAY_LINK',
  'REMINDER',
  'PAID_CONFIRMATION',
  'DRAFT_WHATSAPP',
  'EXPIRED_NOTICE',
  'RESEND_PAY_LINK'
);

CREATE TYPE "QuoteAccessEventType" AS ENUM (
  'OPENED'
);

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Quote" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "quoteNumber" TEXT NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "customerId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerPhone" TEXT,
  "sourceLang" TEXT NOT NULL,
  "targetLang" TEXT NOT NULL,
  "deliveryType" "QuoteDeliveryType" NOT NULL DEFAULT 'DIGITAL_PDF',
  "shippingBase" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vatRate" DECIMAL(5,4) NOT NULL DEFAULT 0.21,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "discountType" "QuoteDiscountType" NOT NULL DEFAULT 'NONE',
  "discountValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notesLegal" TEXT,
  "validityDays" INTEGER NOT NULL DEFAULT 15,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "publicToken" TEXT NOT NULL,
  "tokenExpiresAt" TIMESTAMP(3),
  "pdfUrl" TEXT,
  "pdfHash" TEXT,
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "shippingAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "adminCreatedBy" TEXT,
  "adminSentBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteLine" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "quoteId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "lineTotal" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuotePayment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "quoteId" TEXT NOT NULL,
  "provider" "QuotePaymentProvider" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "stripeSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuotePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MessageLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "quoteId" TEXT NOT NULL,
  "channel" "QuoteMessageChannel" NOT NULL,
  "type" "QuoteMessageType" NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "providerId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessEvent" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "quoteId" TEXT NOT NULL,
  "type" "QuoteAccessEventType" NOT NULL DEFAULT 'OPENED',
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userAgent" TEXT,
  "ipHash" TEXT,
  CONSTRAINT "AccessEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StripeEventLog" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "quoteId" TEXT,
  "payload" JSONB,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StripeEventLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Quote_quoteNumber_key" ON "Quote"("quoteNumber");
CREATE UNIQUE INDEX "Quote_publicToken_key" ON "Quote"("publicToken");
CREATE UNIQUE INDEX "StripeEventLog_eventId_key" ON "StripeEventLog"("eventId");
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

CREATE INDEX "Customer_email_idx" ON "Customer"("email");
CREATE INDEX "Quote_customerEmail_idx" ON "Quote"("customerEmail");
CREATE INDEX "Quote_status_sentAt_idx" ON "Quote"("status", "sentAt");
CREATE INDEX "Quote_validUntil_idx" ON "Quote"("validUntil");
CREATE INDEX "QuoteLine_quoteId_idx" ON "QuoteLine"("quoteId");
CREATE INDEX "QuotePayment_quoteId_createdAt_idx" ON "QuotePayment"("quoteId", "createdAt");
CREATE INDEX "QuotePayment_stripeSessionId_idx" ON "QuotePayment"("stripeSessionId");
CREATE INDEX "QuotePayment_stripePaymentIntentId_idx" ON "QuotePayment"("stripePaymentIntentId");
CREATE INDEX "MessageLog_quoteId_createdAt_idx" ON "MessageLog"("quoteId", "createdAt");
CREATE INDEX "MessageLog_channel_type_idx" ON "MessageLog"("channel", "type");
CREATE INDEX "AccessEvent_quoteId_at_idx" ON "AccessEvent"("quoteId", "at");
CREATE INDEX "StripeEventLog_quoteId_processedAt_idx" ON "StripeEventLog"("quoteId", "processedAt");

ALTER TABLE "Quote"
  ADD CONSTRAINT "Quote_customerId_fkey"
  FOREIGN KEY ("customerId")
  REFERENCES "Customer"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "QuoteLine"
  ADD CONSTRAINT "QuoteLine_quoteId_fkey"
  FOREIGN KEY ("quoteId")
  REFERENCES "Quote"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "QuotePayment"
  ADD CONSTRAINT "QuotePayment_quoteId_fkey"
  FOREIGN KEY ("quoteId")
  REFERENCES "Quote"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "MessageLog"
  ADD CONSTRAINT "MessageLog_quoteId_fkey"
  FOREIGN KEY ("quoteId")
  REFERENCES "Quote"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "AccessEvent"
  ADD CONSTRAINT "AccessEvent_quoteId_fkey"
  FOREIGN KEY ("quoteId")
  REFERENCES "Quote"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "StripeEventLog"
  ADD CONSTRAINT "StripeEventLog_quoteId_fkey"
  FOREIGN KEY ("quoteId")
  REFERENCES "Quote"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
