import test from "node:test";
import assert from "node:assert/strict";
import {
  createReviewToken,
  groupNudgeLeads,
  nudgeSkipReason,
  verifyReviewToken,
  REVIEW_TOKEN_TTL_MS,
  type NudgeRow,
} from "../../lib/lead-nudge.ts";

const row = (p: Partial<NudgeRow> & { id: string }): NudgeRow => ({
  clientEmail: "ana@example.com",
  clientName: null,
  sessionToken: "s1",
  fileName: "a.pdf",
  documentType: "birth_certificate",
  sourceLanguage: "fr",
  targetLanguage: "es",
  estimatedWords: 100,
  quoteAmount: 30,
  createdAt: new Date("2026-10-06T10:00:00Z"),
  ...p,
});
const none = () => false;

test("agrupa por email (case-insensitive) y se queda con la sesión más reciente", () => {
  const g = groupNudgeLeads(
    [
      row({ id: "1" }),
      row({ id: "2", clientEmail: "ANA@example.com", createdAt: new Date("2026-10-06T10:01:00Z") }),
      row({ id: "3", sessionToken: "s0", createdAt: new Date("2026-10-06T09:30:00Z") }),
    ],
    none
  );
  assert.equal(g.length, 1);
  assert.equal(g[0].sessionToken, "s1");
  assert.deepEqual(g[0].rows.map((r) => r.id), ["1", "2"]);
});

test("excluye exp:, staff:, staff/placeholder, sin precio", () => {
  const g = groupNudgeLeads(
    [
      row({ id: "1", sessionToken: "exp:ABC" }),
      row({ id: "2", sessionToken: "staff:x" }),
      row({ id: "3", clientEmail: "juan@hbtj.es" }),
      row({ id: "4", clientEmail: "x@whatsapp.local" }),
      row({ id: "5", clientEmail: "sin@precio.com", quoteAmount: 0 }),
      row({ id: "6", clientEmail: "ok@example.com" }),
    ],
    (e) => e === "juan@hbtj.es" || e.endsWith("@whatsapp.local")
  );
  assert.deepEqual(g.map((x) => x.email), ["ok@example.com"]);
});

const base = { email: "carme.casasayas@example.com", sessionToken: "s1", paidOrderLast24h: false, recentDocs: [{ sessionToken: "s1", orderId: null }], priceRequests: [] };

test("sin nada más: se puede avisar", () => {
  assert.equal(nudgeSkipReason(base), null);
});

test("pedido pagado en 24 h: no se avisa", () => {
  assert.equal(nudgeSkipReason({ ...base, paidOrderLast24h: true }), "paid");
});

test("caso Carme: documento en la puerta + expediente exp: con solicitud viva a lavori", () => {
  const ctx = {
    ...base,
    recentDocs: [
      { sessionToken: "s1", orderId: null },
      { sessionToken: "exp:WECGH2", orderId: null },
    ],
    priceRequests: [{ status: "SENT", customerHint: "Carme · carme.casasayas@example.com", expedienteRef: "exp:WECGH2" }],
  };
  assert.notEqual(nudgeSkipReason(ctx), null);
  // y solo con la solicitud viva (sin docs exp:) también
  assert.equal(nudgeSkipReason({ ...base, priceRequests: ctx.priceRequests }), "price-request");
});

test("solicitud ya hecha desde la puerta (expedienteRef puerta:<token>) no se avisa", () => {
  assert.notEqual(
    nudgeSkipReason({ ...base, priceRequests: [{ status: "SENT", customerHint: null, expedienteRef: "puerta:s1" }] }),
    null
  );
});

test("solicitud no viva de otra persona no bloquea", () => {
  assert.equal(
    nudgeSkipReason({ ...base, priceRequests: [{ status: "CANCELLED", customerHint: "carme.casasayas@example.com", expedienteRef: null }, { status: "SENT", customerHint: "otro@x.com", expedienteRef: null }] }),
    null
  );
});

const SECRET = "test-secret";

test("token válido", () => {
  const t = createReviewToken(SECRET, "s1", "fr", 1_000);
  assert.deepEqual(verifyReviewToken(SECRET, t, 2_000), { sessionToken: "s1", locale: "fr" });
});

test("token manipulado o con otro secreto", () => {
  const t = createReviewToken(SECRET, "s1", "es", 1_000);
  const [p, s] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ s: "s2", l: "es", exp: 9e15 })).toString("base64url");
  assert.equal(verifyReviewToken(SECRET, `${forged}.${s}`, 2_000), null);
  assert.equal(verifyReviewToken(SECRET, `${p}.AAAA`, 2_000), null);
  assert.equal(verifyReviewToken("otro", t, 2_000), null);
  assert.equal(verifyReviewToken(SECRET, "basura", 2_000), null);
  assert.equal(verifyReviewToken(SECRET, null, 2_000), null);
});

test("token caducado a los 14 días", () => {
  const t = createReviewToken(SECRET, "s1", "de", 1_000);
  assert.notEqual(verifyReviewToken(SECRET, t, 1_000 + REVIEW_TOKEN_TTL_MS - 1), null);
  assert.equal(verifyReviewToken(SECRET, t, 1_000 + REVIEW_TOKEN_TTL_MS + 1), null);
});
