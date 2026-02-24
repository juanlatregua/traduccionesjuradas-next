CREATE TABLE "OrderPaymentEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" "PaymentMethod" NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderPaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderPaymentEvent_idempotencyKey_key" ON "OrderPaymentEvent"("idempotencyKey");
CREATE INDEX "OrderPaymentEvent_orderId_createdAt_idx" ON "OrderPaymentEvent"("orderId", "createdAt");
CREATE INDEX "OrderPaymentEvent_provider_providerEventId_idx" ON "OrderPaymentEvent"("provider", "providerEventId");

ALTER TABLE "OrderPaymentEvent"
ADD CONSTRAINT "OrderPaymentEvent_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
