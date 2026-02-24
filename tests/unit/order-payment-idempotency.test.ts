import test from "node:test";
import assert from "node:assert/strict";
import {
  buildManualPaymentProviderEventId,
  buildOrderPaymentIdempotencyKey,
  isDuplicateOrderPaymentEventError,
} from "../../lib/order-payment-idempotency.ts";

test("webhook duplicado de Stripe genera la misma clave idempotente", () => {
  const first = buildOrderPaymentIdempotencyKey({
    reference: "26_ABC123",
    provider: "STRIPE",
    providerEventId: "pi_123456",
  });
  const second = buildOrderPaymentIdempotencyKey({
    reference: " 26_abc123 ",
    provider: "STRIPE",
    providerEventId: " PI_123456 ",
  });

  assert.equal(first, second);
});

test("doble submit manual reutiliza providerEventId estable", () => {
  const providerEventId = buildManualPaymentProviderEventId("26_ABC123", "BIZUM");
  const first = buildOrderPaymentIdempotencyKey({
    reference: "26_ABC123",
    provider: "BIZUM",
    providerEventId,
  });
  const second = buildOrderPaymentIdempotencyKey({
    reference: "26_ABC123",
    provider: "BIZUM",
    providerEventId: buildManualPaymentProviderEventId("26_ABC123", "BIZUM"),
  });

  assert.equal(first, second);
});

test("detecta error de idempotencia Prisma para eventos de pago", () => {
  assert.equal(isDuplicateOrderPaymentEventError({ code: "P2002" }), true);
  assert.equal(isDuplicateOrderPaymentEventError({ code: "p2002" }), true);
  assert.equal(isDuplicateOrderPaymentEventError({ code: "P2025" }), false);
});
