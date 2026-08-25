import test from "node:test";
import assert from "node:assert/strict";

process.env.ORDER_TOKEN_SECRET = process.env.ORDER_TOKEN_SECRET || "test-secret";
const { generateLavoriOneTapToken, verifyLavoriOneTapToken } = await import("../../lib/lavori-onetap.ts");

test("one-tap: el token vale solo para su sesión y caduca", () => {
  const t = generateLavoriOneTapToken("sess-1", 60);
  assert.equal(verifyLavoriOneTapToken("sess-1", t), true);
  assert.equal(verifyLavoriOneTapToken("sess-2", t), false);
  assert.equal(verifyLavoriOneTapToken("sess-1", t + "0"), false);
  const caducado = generateLavoriOneTapToken("sess-1", -1);
  assert.equal(verifyLavoriOneTapToken("sess-1", caducado), false);
});
