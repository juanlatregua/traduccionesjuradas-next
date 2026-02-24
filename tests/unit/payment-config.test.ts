import test from "node:test";
import assert from "node:assert/strict";
import { isStripeConfigured, resolveCardProvider } from "../../lib/payment-config.ts";

const ORIGINAL_STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const ORIGINAL_REDSYS_SECRET = process.env.REDSYS_SECRET_KEY;
const ORIGINAL_REDSYS_CODE = process.env.REDSYS_MERCHANT_CODE;

function restoreEnv() {
  process.env.STRIPE_SECRET_KEY = ORIGINAL_STRIPE_SECRET;
  process.env.REDSYS_SECRET_KEY = ORIGINAL_REDSYS_SECRET;
  process.env.REDSYS_MERCHANT_CODE = ORIGINAL_REDSYS_CODE;
}

test("isStripeConfigured solo acepta claves Stripe válidas", () => {
  try {
    process.env.STRIPE_SECRET_KEY = "sk_test_1234567890abcdef";
    assert.equal(isStripeConfigured(), true);

    process.env.STRIPE_SECRET_KEY = "sk_live_invalid";
    assert.equal(isStripeConfigured(), false);

    process.env.STRIPE_SECRET_KEY = "";
    assert.equal(isStripeConfigured(), false);
  } finally {
    restoreEnv();
  }
});

test("resolveCardProvider aplica fallback de redsys si Stripe no está válido", () => {
  try {
    process.env.STRIPE_SECRET_KEY = "invalid";
    process.env.REDSYS_SECRET_KEY = "secret";
    process.env.REDSYS_MERCHANT_CODE = "merchant";

    assert.equal(resolveCardProvider("stripe"), "redsys");
  } finally {
    restoreEnv();
  }
});
