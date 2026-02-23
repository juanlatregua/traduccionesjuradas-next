import test from "node:test";
import assert from "node:assert/strict";
import { isDuplicateStripeEventError } from "../../lib/quote-idempotency.ts";

test("detecta error idempotente de Prisma (P2002)", () => {
  assert.equal(isDuplicateStripeEventError({ code: "P2002" }), true);
  assert.equal(isDuplicateStripeEventError({ code: "p2002" }), true);
});

test("no marca como duplicado otros errores", () => {
  assert.equal(isDuplicateStripeEventError({ code: "P2025" }), false);
  assert.equal(isDuplicateStripeEventError(new Error("otro error")), false);
  assert.equal(isDuplicateStripeEventError(null), false);
});
