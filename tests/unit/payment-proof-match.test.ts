import test from "node:test";
import assert from "node:assert/strict";

const {
  matchProofToOrder,
  PROOF_MIN_CONFIDENCE,
  normalizeConfidence,
  proofNeedsManualReview,
  transferFingerprint,
  findReusedProof,
} = await import("../../lib/payment-proof-match.ts");
const { planQuotePaidSync } = await import("../../lib/quote-paid-sync.ts");
const { transferAccountsLast4 } = await import("../../lib/payment-labels.ts");

const ours = transferAccountsLast4();
const ctx = {
  totalCents: 6655,
  ourAccountsLast4: ours,
  since: new Date("2026-09-18T10:00:00Z"),
  now: new Date("2026-09-21T10:00:00Z"),
};
const good = {
  esJustificante: true,
  confianza: 0.95,
  importeCents: 6655,
  moneda: "EUR",
  cuentaDestinoUltimos4: "7991",
  fecha: "2026-09-20",
};

test("solo confirman solas las cuentas de la empresa: Sabadell 7991 y BBVA 6991", () => {
  assert.deepEqual([...ours].sort(), ["6991", "7991"]);
});

test("transferencia a una cuenta personal (Openbank/Revolut): no cuadra", () => {
  for (const c of ["5264", "2489"]) {
    assert.equal(matchProofToOrder({ ...good, cuentaDestinoUltimos4: c }, ctx).ok, false);
  }
});

test("justificante bueno: cuadra", () => {
  assert.deepEqual(matchProofToOrder(good, ctx), { ok: true });
});

test("importe distinto: no cuadra", () => {
  const r = matchProofToOrder({ ...good, importeCents: 6600 }, ctx);
  assert.equal(r.ok, false);
  assert.match((r as any).reasons.join(" "), /importe/);
});

test("cuenta ajena: no cuadra", () => {
  const r = matchProofToOrder({ ...good, cuentaDestinoUltimos4: "1234" }, ctx);
  assert.equal(r.ok, false);
  assert.match((r as any).reasons.join(" "), /no es nuestra/);
});

test("sin cuenta de destino (p.ej. Bizum): no cuadra", () => {
  assert.equal(matchProofToOrder({ ...good, cuentaDestinoUltimos4: null }, ctx).ok, false);
});

test("fecha futura: no cuadra", () => {
  const r = matchProofToOrder({ ...good, fecha: "2026-09-22" }, ctx);
  assert.equal(r.ok, false);
  assert.match((r as any).reasons.join(" "), /futuro/);
});

test("fecha anterior al envío del presupuesto: no cuadra; el mismo día sí", () => {
  const r = matchProofToOrder({ ...good, fecha: "2026-09-17" }, ctx);
  assert.equal(r.ok, false);
  assert.match((r as any).reasons.join(" "), /anterior/);
  assert.equal(matchProofToOrder({ ...good, fecha: "2026-09-18" }, ctx).ok, true);
  assert.equal(matchProofToOrder({ ...good, fecha: "2026-09-21" }, ctx).ok, true);
});

test("no es justificante: no cuadra", () => {
  assert.equal(matchProofToOrder({ ...good, esJustificante: false }, ctx).ok, false);
});

test("confianza baja: no cuadra", () => {
  assert.equal(matchProofToOrder({ ...good, confianza: PROOF_MIN_CONFIDENCE - 0.01 }, ctx).ok, false);
});

test("moneda distinta de EUR o ausente: no cuadra", () => {
  assert.equal(matchProofToOrder({ ...good, moneda: "USD" }, ctx).ok, false);
  assert.equal(matchProofToOrder({ ...good, moneda: null }, ctx).ok, false);
  assert.equal(matchProofToOrder({ ...good, moneda: "eur" }, ctx).ok, true);
});

test("varios fallos a la vez: los motivos se acumulan", () => {
  const r = matchProofToOrder({ ...good, importeCents: 100, moneda: "USD", fecha: null }, ctx);
  assert.equal(r.ok, false);
  assert.equal((r as any).reasons.length, 3);
});

test("confianza 90 (en %) se lee como 0,9 y cuadra; nunca pasa de 1", () => {
  assert.equal(normalizeConfidence(90), 0.9);
  assert.equal(normalizeConfidence(250), 1);
  assert.equal(normalizeConfidence("x"), 0);
  assert.deepEqual(matchProofToOrder({ ...good, confianza: 90 }, ctx), { ok: true });
});

test("Bizum (o PayPal, o sin método) va a revisión manual; solo TRANSFER se lee", () => {
  assert.equal(proofNeedsManualReview("BIZUM"), true);
  assert.equal(proofNeedsManualReview("PAYPAL"), true);
  assert.equal(proofNeedsManualReview(null), true);
  assert.equal(proofNeedsManualReview("TRANSFER"), false);
});

test("el mismo justificante no lanza dos pedidos: por fichero o por transferencia", () => {
  const read = { ...good, ordenante: "José Pérez" };
  const fp = transferFingerprint(read);
  assert.equal(fp, "6655|2026-09-20|joseperez|7991");
  assert.equal(transferFingerprint({ ...read, ordenante: "JOSE PEREZ" }), fp);
  const lanzados = [{ reference: "26_AAAAAA", fileHash: "h1", fingerprint: fp }];

  assert.deepEqual(findReusedProof({ reference: "26_BBBBBB", fileHash: "h1", fingerprint: null }, lanzados), {
    reference: "26_AAAAAA",
    by: "fichero",
  });
  assert.deepEqual(findReusedProof({ reference: "26_BBBBBB", fileHash: "h2", fingerprint: fp }, lanzados), {
    reference: "26_AAAAAA",
    by: "transferencia",
  });
  assert.equal(findReusedProof({ reference: "26_AAAAAA", fileHash: "h1", fingerprint: fp }, lanzados), null, "el propio pedido no cuenta");
  assert.equal(
    findReusedProof({ reference: "26_BBBBBB", fileHash: "h2", fingerprint: transferFingerprint({ ...read, fecha: "2026-09-21" }) }, lanzados),
    null
  );
  assert.equal(transferFingerprint({ ...read, importeCents: null }), null);
});

test("tras confirmar, el presupuesto enlazado queda PAID con su QuotePayment (patrón mark-paid)", () => {
  const now = new Date("2026-09-21T10:00:00Z");
  const quote = { id: "q1", status: "OPENED", paidAt: null, totalEur: 66.55, currency: "EUR" };
  assert.deepEqual(planQuotePaidSync(quote, "TRANSFER", now), {
    payment: { quoteId: "q1", provider: "TRANSFER", amount: 66.55, currency: "EUR" },
    update: { status: "PAID", paidAt: now },
  });
  assert.equal(planQuotePaidSync({ ...quote, paidAt: now }, "TRANSFER", now), null, "ya pagado: no se duplica");
  assert.equal(planQuotePaidSync({ ...quote, status: "PAID" }, "TRANSFER", now), null);
  assert.equal(planQuotePaidSync({ ...quote, status: "EXPIRED" }, "TRANSFER", now), null);
  assert.equal(planQuotePaidSync(null, "BIZUM", now), null);
});
