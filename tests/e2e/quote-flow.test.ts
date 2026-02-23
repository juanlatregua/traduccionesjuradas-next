import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionQuote,
  isQuotePayableStatus,
  normalizeQuoteStatus,
} from "../../lib/quotes.ts";

test("flujo mínimo de presupuesto: DRAFT -> SENT -> OPENED -> PAID -> IN_PROGRESS -> DELIVERED", () => {
  let status = normalizeQuoteStatus("DRAFT");
  assert.equal(canTransitionQuote(status, "SENT"), true);
  status = "SENT";
  assert.equal(isQuotePayableStatus(status), true);

  assert.equal(canTransitionQuote(status, "OPENED"), true);
  status = "OPENED";
  assert.equal(isQuotePayableStatus(status), true);

  assert.equal(canTransitionQuote(status, "PAID"), true);
  status = "PAID";
  assert.equal(isQuotePayableStatus(status), false);

  assert.equal(canTransitionQuote(status, "IN_PROGRESS"), true);
  status = "IN_PROGRESS";
  assert.equal(canTransitionQuote(status, "DELIVERED"), true);
});
