import test from "node:test";
import assert from "node:assert/strict";
import { frAutoReviewReasons, runFrAuto, type FrAutoData, type FrAutoIO } from "../../../lib/entrada/fr-auto.ts";
import type { EntradaRow } from "../../../lib/entrada/store.ts";
import { buildLines } from "../../../lib/lectura-constructor/lines.ts";
import { computePagePricing } from "../../../lib/pricing-engine/page-pricing.ts";
import { priceFrSegments, type Segment } from "../../../lib/agente-bandeja-math.ts";
import { sessionKeyOf } from "../../../lib/entrada/store.ts";
import { ap } from "../lectura/fixtures.ts";
import { working } from "../lectura-constructor/fakes.ts";

const files = [
  { position: 1, name: "acta.pdf", url: "https://x.public.blob.vercel-storage.com/acta.pdf", pageCount: 3 },
  { position: 2, name: "apostilla.jpg", url: "https://x.public.blob.vercel-storage.com/apostilla.jpg", pageCount: 1 },
];
const entrada = (o: Partial<EntradaRow> = {}) =>
  ({ id: "e1", casoId: "c1", email: "a@b.es", nombre: "Ana", phone9: null, lang: "es", urgency: "ASAP", emailVerifiedAt: new Date(), marketingConsentAt: new Date(), sourceLang: "fr", targetLang: "es", targetLangs: ["es"], ...o }) as EntradaRow;
const data = (docs = [working("D1", [[1, 1]])], lote: Record<string, unknown> = {}): FrAutoData =>
  ({ lote: { id: "L1", status: "ok", clean: true, reasons: [], targetLang: "es", sessionKey: sessionKeyOf("e1"), quoteId: null, updatedAt: new Date(), ...lote } as never, files: files as never, documents: docs });

function fakeIO(mode: "off" | "draft" | "fr", decision: { action: "send" } | { action: "alert"; reasons: string[] } = { action: "send" }) {
  const calls: string[] = [];
  const io: FrAutoIO = {
    mode: () => mode,
    liveBlock: async () => null,
    claim: async () => (calls.push("claim"), true),
    createDraft: async () => (calls.push("draft"), { quoteId: "q1", quoteNumber: "2026-0001", netEur: 30, totalEur: 36.3, decision }),
    link: async () => void calls.push("link"),
    send: async () => void calls.push("send"),
    staff: async (t) => void calls.push(`staff:${t.slice(0, 14)}`),
  };
  return { io, calls };
}

test("off: no hace nada", async () => {
  const { io, calls } = fakeIO("off");
  assert.equal((await runFrAuto(io, entrada(), data())).action, "none");
  assert.deepEqual(calls, []);
});

test("draft: Quote DRAFT y aviso, nada se envía", async () => {
  const { io, calls } = fakeIO("draft");
  assert.equal((await runFrAuto(io, entrada(), data())).action, "drafted");
  assert.ok(calls.includes("draft") && !calls.includes("send") && calls.some((c) => c.startsWith("staff")));
});

test("fr: lectura limpia y decisión en verde → se envía", async () => {
  const { io, calls } = fakeIO("fr");
  assert.equal((await runFrAuto(io, entrada(), data())).action, "sent");
  assert.ok(calls.includes("send"));
});

test("fr: lectura con motivos de revisión → borrador, no decide ni envía", async () => {
  const { io, calls } = fakeIO("fr");
  const r = await runFrAuto(io, entrada(), data(undefined, { clean: false, reasons: [{ code: "long_document", detail: "x" }] }));
  assert.equal(r.action, "drafted");
  assert.ok(!calls.includes("send"));
});

test("fr: decisión de cierre en alerta (tope, duplicado…) → borrador", async () => {
  const { io, calls } = fakeIO("fr", { action: "alert", reasons: ["tope"] });
  assert.equal((await runFrAuto(io, entrada(), data())).action, "drafted");
  assert.ok(!calls.includes("send"));
});

test("fr: sin consentimiento de email → borrador", async () => {
  const { io, calls } = fakeIO("fr");
  assert.equal((await runFrAuto(io, entrada({ marketingConsentAt: null }), data())).action, "drafted");
  assert.ok(!calls.includes("send"));
});

test("precio a mano en un documento → borrador (nunca precio sin persona)", async () => {
  const { io } = fakeIO("fr");
  const d = working("D1", [[1, 1]], {}, { manualPriceCents: 4000 });
  assert.equal((await runFrAuto(io, entrada(), data([d]))).action, "drafted");
});

test("no entra: es>fr, varios destinos, lote no leído, email sin verificar", async () => {
  const { io, calls } = fakeIO("fr");
  const esFr = working("D1", [[1, 1]], { sourceLang: "es" });
  assert.equal((await runFrAuto(io, entrada({ targetLang: "fr", targetLangs: ["fr"] }), data([esFr], { targetLang: "fr" }))).action, "none");
  assert.equal((await runFrAuto(io, entrada({ targetLangs: ["es", "en"] }), data())).action, "none");
  assert.equal((await runFrAuto(io, entrada(), data(undefined, { status: "running" }))).action, "none");
  assert.equal((await runFrAuto(io, entrada({ emailVerifiedAt: null }), data())).action, "none");
  assert.deepEqual(calls, []);
});

test("reclamo ya tomado: no crea nada", async () => {
  const { io, calls } = fakeIO("fr");
  io.claim = async () => false;
  assert.equal((await runFrAuto(io, entrada(), data())).action, "none");
  assert.ok(!calls.includes("draft"));
});

// Coherencia lib/dinero (R2) frente a computePagePricing (carril viejo). No asserta igualdad: documenta diferencias.
const seg = (o: Partial<Segment>): Segment => ({
  fileName: "x.pdf", specificType: "birth_certificate", labelEs: "Certificado de nacimiento", labelFr: null, category: "civil_registry", sourceLang: "fr", targetLang: "es",
  pages: 1, words: 200, hasTables: false, hasApostille: false, apostilleSeparatePage: false, confidence: 0.9, legible: true, risky: false, riskReasons: [], ...o,
});
test("coherencia de totales dinero vs page-pricing (informe)", () => {
  const eur = (c: number | null) => (c === null ? "a mano" : (c / 100).toFixed(2));
  const cases: { name: string; docs: ReturnType<typeof working>[]; segs: Segment[] }[] = [
    { name: "1 pág fr>es", docs: [working("D1", [[1, 1]])], segs: [seg({})] },
    { name: "3 págs fr>es", docs: [working("D1", [[1, 1], [1, 2], [1, 3]])], segs: [seg({ pages: 3 })] },
    { name: "1 pág + apostilla (hoja aparte)", docs: [working("D1", [[1, 1]], { apostille: ap([[2, 1]], { number: "A1" }) })], segs: [seg({ pages: 2, hasApostille: true })] },
    { name: "1 pág + apostilla (analisis pages=1)", docs: [working("D1", [[1, 1]], { apostille: ap([[2, 1]], { number: "A1" }) })], segs: [seg({ pages: 1, hasApostille: true })] },
    { name: "es>fr", docs: [working("D1", [[1, 1]], { sourceLang: "es" })], segs: [seg({ sourceLang: "es", targetLang: "fr" })] },
    { name: "lote de 5 actas 1 pág", docs: [1, 2, 3, 4, 5].map((i) => working(`D${i}`, [[1, i]])), segs: [1, 2, 3, 4, 5].map(() => seg({})) },
    { name: "5 extractos bancarios 1 pág", docs: [1, 2, 3, 4, 5].map((i) => working(`B${i}`, [[1, i]], { type: "bank_statement", category: "financial" })), segs: [1, 2, 3, 4, 5].map(() => seg({ specificType: "bank_statement", category: "financial" })) },
  ];
  const rows: string[] = [];
  for (const c of cases) {
    const target = c.name === "es>fr" ? "fr" : "es";
    const r = buildLines(c.docs, files as never, target);
    const nuevo = r.blockers.length === 0 && r.totals ? r.totals.subtotal : null;
    const old = priceFrSegments(c.segs);
    const viejo = old.ok ? Math.round(old.netEur * 100) : null;
    rows.push(`${c.name.padEnd(38)} dinero=${eur(nuevo).padStart(8)}  page-pricing=${eur(viejo).padStart(8)}  ${nuevo === viejo ? "IGUAL" : "DIFIERE"}`);
    assert.ok(computePagePricing !== undefined);
  }
  console.log("\n" + rows.join("\n"));
});

test("1: segunda entrada del mismo caso con presupuesto vivo → no crea ni enlaza", async () => {
  const { io, calls } = fakeIO("fr");
  io.createDraft = async () => ({ skip: "el caso ya tiene el presupuesto 2026-0001" });
  assert.equal((await runFrAuto(io, entrada({ id: "e2" }), data(undefined, { sessionKey: sessionKeyOf("e2") }))).action, "none");
  assert.ok(!calls.includes("send") && !calls.includes("link"));
});

test("1: lote ajeno, lote ya con presupuesto o entrada que se une a caso existente → ni reclama", async () => {
  const { io, calls } = fakeIO("fr");
  assert.equal((await runFrAuto(io, entrada(), data(undefined, { sessionKey: sessionKeyOf("otra") }))).action, "none");
  assert.equal((await runFrAuto(io, entrada(), data(undefined, { quoteId: "q0" }))).action, "none");
  assert.equal((await runFrAuto(io, entrada({ regla: "huella" }), data())).action, "none");
  assert.deepEqual(calls, []);
});

test("1: bloqueo vivo (jurado, cliente dijo no) → no reclama", async () => {
  const { io, calls } = fakeIO("fr");
  io.liveBlock = async () => "ya lo lleva alguien";
  assert.equal((await runFrAuto(io, entrada(), data())).action, "none");
  assert.ok(!calls.includes("claim") && !calls.includes("draft"));
});

test("2: el borrador enlaza el lote y devuelve su número para el aviso", async () => {
  const { io, calls } = fakeIO("draft");
  const r = await runFrAuto(io, entrada(), data());
  assert.equal(r.quoteNumber, "2026-0001");
  assert.ok(calls.indexOf("link") > calls.indexOf("draft"));
});

test("3: si el envío lanza, avisa por SMS con el número y queda en borrador", async () => {
  const { io, calls } = fakeIO("fr");
  io.send = async () => { throw new Error("graph caído"); };
  const r = await runFrAuto(io, entrada(), data());
  assert.equal(r.action, "drafted");
  assert.equal(r.quoteNumber, "2026-0001");
  assert.ok(calls.some((c) => c.startsWith("staff")));
});

test("fiscal/financiero o bilingüe: nunca sale solo aunque PUERTA_FR=fr (queda borrador)", async () => {
  const fiscal = data([working("D1", [[1, 1]], {}, { category: "financial", type: "tax_return" })]);
  assert.match(frAutoReviewReasons(fiscal, 0).join(" "), /fiscal/);
  assert.match(frAutoReviewReasons(data([working("D1", [[1, 1]], {}, { isBilingualDuplicate: true })]), 0).join(" "), /bilingüe/);
  assert.deepEqual(frAutoReviewReasons(data(), 0), []);
});
