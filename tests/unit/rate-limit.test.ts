import test from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit } from "../../lib/rate-limit.ts";

const ORIGINAL_RATE_LIMIT_STORE = process.env.RATE_LIMIT_STORE;

test("checkRateLimit bloquea cuando supera el limite en modo memoria", async () => {
  try {
    process.env.RATE_LIMIT_STORE = "memory";
    const key = `test:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`;

    const first = await checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    assert.equal(first.ok, true);

    const second = await checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    assert.equal(second.ok, true);

    const third = await checkRateLimit({ key, limit: 2, windowMs: 60_000 });
    assert.equal(third.ok, false);
    if (!third.ok) {
      assert.ok(third.retryAfterSec >= 1);
    }
  } finally {
    process.env.RATE_LIMIT_STORE = ORIGINAL_RATE_LIMIT_STORE;
  }
});
