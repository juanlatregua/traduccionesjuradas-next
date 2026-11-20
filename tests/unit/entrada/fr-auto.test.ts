import test from "node:test";
import assert from "node:assert/strict";
import { runFrAuto, type FrAutoData, type FrAutoIO } from "../../../lib/entrada/fr-auto.ts";
import type { EntradaRow } from "../../../lib/entrada/store.ts";
import { buildLines } from "../../../lib/lectura-constructor/lines.ts";
import { computePagePricing } from "../../../lib/pricing-engine/page-pricing.ts";
import { priceFrSegments, type Segment } from "../../../lib/agente-bandeja-math.ts";
import { ap } from "../lectura/fixtures.ts";
import { working } from "../lectura-constructor/fakes.ts";

const files = [
  { position: 1, name: "acta.pdf", url: "https://x.public.blob.vercel-storage.com/acta.pdf", pageCount: 3 },
  { position: 2, name: "apostilla.jpg", url: "https://x.public.blob.vercel-storage.com/apostilla.jpg", pageCount: 1 },
];
const entrada = (o: Partial<EntradaRow> = {}) =>
  ({ id: "e1", casoId: "c1", email: "a@b.es", nombre: "Ana", phone9: null, lang: "es", urgency: "ASAP", emailVerifiedAt: new Date(), marketingConsentAt: new Date(), sourceLang: "fr", targetLang: "es", targetLangs: ["es"], ...o }) as EntradaRow;
const data = (docs = [working("D1", [[1, 1]])], lote: Record<string, unknown> = {}): FrAutoData =>
  ({ lote: { status: "ok", clean: true, reasons: [], targetLang: "es", ...lote } as never, files: files as never, documents: docs });

function fakeIO(mode: "off" | "draft" | "fr", decision: { action: "send" } | { action: "alert"; reasons: string[] } = { action: "send" }) {
  const calls: string[] = [];
  const io: FrAutoIO = {
    mode: () => mode,
    claim: async () => (calls.push("claim"), true),
    createDraft: async () => (calls.push("draft"), { quoteId: "q1", quoteNumber: "2026-0001", netEur: 30, totalEur: 36.3 }),
    decide: async () => (calls.push("decide"), decision),
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
  assert.ok(!calls.includes("send") && !calls.includes("decide"));
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
