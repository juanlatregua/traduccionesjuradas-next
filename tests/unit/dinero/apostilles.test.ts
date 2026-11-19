import test from "node:test";
import assert from "node:assert/strict";
import { priceFrToEs, FR_APOSTILLE_EXTRA_CENTS } from "../../../lib/dinero/tariff-fr.ts";

const cert = { docType: "birth_certificate", category: "civil_registry", pages: 1, words: 200, apostilleOnSeparatePage: false };

test("apostilles: absent or 1 price exactly like before (3500 c)", () => {
  for (const extra of [{}, { apostilles: 1 }]) {
    const p = priceFrToEs({ ...cert, apostille: true, ...extra });
    assert.ok(p.kind === "priced" && p.cents === 3500);
  }
  const none = priceFrToEs({ ...cert, apostille: false });
  assert.ok(none.kind === "priced" && none.cents === 3000);
  const three = priceFrToEs({ ...cert, apostille: true, apostilles: 3 });
  assert.ok(three.kind === "priced" && three.cents === 3000 + 3 * FR_APOSTILLE_EXTRA_CENTS);
});

test("apostilles: never corrected in silence", () => {
  for (const n of [0, -3, 2.9, NaN, Infinity, 1e6, 51]) {
    assert.throws(() => priceFrToEs({ ...cert, apostille: true, apostilles: n }), RangeError, String(n));
  }
  assert.throws(() => priceFrToEs({ ...cert, apostille: false, apostilles: 3 }), RangeError);
  assert.throws(() => priceFrToEs({ ...cert, apostille: false, apostilles: 1 }), RangeError);
});
