import test from "node:test";
import assert from "node:assert/strict";

// Set the secret before importing the module
process.env.ORDER_TOKEN_SECRET = "test-secret-for-unit-tests-32chars!!";

const { generateOrderToken, verifyOrderToken, buildSignedOrderUrl } = await import("../../lib/order-token.ts");

test("generateOrderToken devuelve un hex string de 64 chars", () => {
  const token = generateOrderToken("TJ-2026-0001");
  assert.equal(typeof token, "string");
  assert.equal(token.length, 64);
  assert.match(token, /^[0-9a-f]{64}$/);
});

test("generateOrderToken es determinista (mismo input → mismo output)", () => {
  const t1 = generateOrderToken("TJ-2026-0001");
  const t2 = generateOrderToken("TJ-2026-0001");
  assert.equal(t1, t2);
});

test("generateOrderToken produce tokens distintos para referencias distintas", () => {
  const t1 = generateOrderToken("TJ-2026-0001");
  const t2 = generateOrderToken("TJ-2026-0002");
  assert.notEqual(t1, t2);
});

test("verifyOrderToken acepta token correcto", () => {
  const token = generateOrderToken("TJ-2026-0001");
  assert.equal(verifyOrderToken("TJ-2026-0001", token), true);
});

test("verifyOrderToken rechaza token incorrecto", () => {
  assert.equal(verifyOrderToken("TJ-2026-0001", "0".repeat(64)), false);
});

test("verifyOrderToken rechaza token mal formado", () => {
  assert.equal(verifyOrderToken("TJ-2026-0001", "not-hex"), false);
  assert.equal(verifyOrderToken("TJ-2026-0001", ""), false);
});

test("verifyOrderToken rechaza token de otra referencia", () => {
  const token = generateOrderToken("TJ-2026-0002");
  assert.equal(verifyOrderToken("TJ-2026-0001", token), false);
});

test("buildSignedOrderUrl incluye token y path correcto", () => {
  const url = buildSignedOrderUrl("TJ-2026-0001", "pagar");
  assert.ok(url.includes("/area-cliente/pedido/TJ-2026-0001/pagar"));
  assert.ok(url.includes("token="));
});

test("buildSignedOrderUrl detalle no incluye /pagar", () => {
  const url = buildSignedOrderUrl("TJ-2026-0001", "detalle");
  assert.ok(url.includes("/area-cliente/pedido/TJ-2026-0001"));
  assert.ok(!url.includes("/pagar"));
});

test("buildSignedOrderUrl incluye params extra", () => {
  const url = buildSignedOrderUrl("TJ-2026-0001", "pagar", { src: "wa", agent: "pm" });
  assert.ok(url.includes("src=wa"));
  assert.ok(url.includes("agent=pm"));
  assert.ok(url.includes("token="));
});
