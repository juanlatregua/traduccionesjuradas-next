import test from "node:test";
import assert from "node:assert/strict";
import { buildOrderPaymentIdempotencyKey } from "../../lib/order-payment-idempotency.ts";

function shouldProcessOnce(seen: Set<string>, input: {
  reference: string;
  provider: Parameters<typeof buildOrderPaymentIdempotencyKey>[0]["provider"];
  providerEventId: string;
}) {
  const key = buildOrderPaymentIdempotencyKey(input);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

test("flujo idempotente: webhook duplicado solo procesa una vez", () => {
  const seen = new Set<string>();
  const payload = {
    reference: "26_ABC123",
    provider: "STRIPE" as const,
    providerEventId: "pi_stripe_001",
  };

  assert.equal(shouldProcessOnce(seen, payload), true);
  assert.equal(shouldProcessOnce(seen, payload), false);
});

test("flujo idempotente: doble submit de captura PayPal se rechaza en replay", () => {
  const seen = new Set<string>();
  const payload = {
    reference: "26_ABC123",
    provider: "PAYPAL" as const,
    providerEventId: "capture_0001",
  };

  assert.equal(shouldProcessOnce(seen, payload), true);
  assert.equal(shouldProcessOnce(seen, payload), false);
});
