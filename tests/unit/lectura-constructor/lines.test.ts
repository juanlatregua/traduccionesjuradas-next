import test from "node:test";
import assert from "node:assert/strict";
import { buildLines, quotePayload, linesView } from "../../../lib/lectura-constructor/lines.ts";
import { priceFrToEs } from "../../../lib/dinero/tariff-fr.ts";
import { ap } from "../lectura/fixtures.ts";
import { working } from "./fakes.ts";

const files = [
  { position: 1, name: "acta.pdf", url: "https://x.public.blob.vercel-storage.com/acta.pdf", pageCount: 3 },
  { position: 2, name: "apostilla.jpg", url: "https://x.public.blob.vercel-storage.com/apostilla.jpg", pageCount: 1 },
];

test("FR→ES: birth certificate with its apostille is one line named with the apostille number, priced by lib/dinero", () => {
  const d = working("D1", [[1, 1]], { holder: "Ana Pérez", apostille: ap([[2, 1]], { number: "A-77" }) });
  const r = buildLines([d], files, "es");
  assert.equal(r.blockers.length, 0);
  assert.equal(r.lines.length, 1);
  const line = r.lines[0];
  assert.equal(line.description, "Certificado de nacimiento Ana Pérez — apostilla n.º A-77");
  const expected = priceFrToEs({ docType: "birth_certificate", category: "civil_registry", pages: 1, words: 200, apostille: true, apostilleOnSeparatePage: false });
  assert.equal(expected.kind, "priced");
  assert.equal(line.unitPriceCents, expected.kind === "priced" ? expected.cents : -1);
  assert.equal(line.unitPriceCents, 3500);
  assert.equal(line.priceSource, "fr_tariff");
  assert.deepEqual(line.cost, { known: true, baseCents: 0, ownWork: true });
  assert.equal(line.sourceFileUrl, files[0].url);
  assert.equal(line.pageStart, 1);
  assert.equal(line.pageEnd, 1);
  assert.deepEqual(r.totals && { sub: r.totals.subtotal, vat: r.totals.vat, total: r.totals.total }, { sub: 3500, vat: 735, total: 4235 });
  const p = quotePayload(r)!;
  assert.equal(p.vatRate, 0.21);
  assert.deepEqual(p.lines[0], {
    description: "Certificado de nacimiento Ana Pérez — apostilla n.º A-77", quantity: 1, unitPrice: "35.00",
    sourceFileUrl: files[0].url, pageStart: 1, pageEnd: 1, docKind: "birth_certificate",
  });
  assert.equal(linesView(r).totals?.total, "42,35 €");
});

test("apostille whose number could not be read says so in the line", () => {
  const r = buildLines([working("D1", [[1, 1]], { apostille: ap([[2, 1]], { number: null }) })], files, "es");
  assert.equal(r.lines[0].description, "Certificado de nacimiento — apostilla (n.º no legible)");
});

test("pair without tariff never gets a price on its own: a person types it", () => {
  const d = working("D1", [[1, 1]], { sourceLang: "de" });
  const r = buildLines([d], files, "es");
  assert.equal(r.lines.length, 0);
  assert.match(r.blockers[0].detail, /a mano/);
  assert.equal(quotePayload(r), null);
});

test("manual price with unknown cost is a warning (the margin brake stops it at sending); known cost below the floor blocks", () => {
  const unknown = buildLines([working("D1", [[1, 1]], { sourceLang: "de" }, { manualPriceCents: 6000 })], files, "es");
  assert.equal(unknown.blockers.length, 0);
  assert.match(unknown.warnings[0].detail, /Coste del traductor sin informar/);
  assert.equal(quotePayload(unknown)?.lines[0].unitPrice, "60.00");
  assert.equal(quotePayload(unknown)?.lines[0].supplierUnitCost, undefined);

  const low = buildLines([working("D1", [[1, 1]], { sourceLang: "de" }, { manualPriceCents: 5000, manualCostCents: 4800 })], files, "es");
  assert.match(low.blockers[0].detail, /Margen bajo/);
  assert.equal(quotePayload(low), null);

  const loss = buildLines([working("D1", [[1, 1]], { sourceLang: "de" }, { manualPriceCents: 4000, manualCostCents: 4000 })], files, "es");
  assert.match(loss.blockers[0].detail, /Pérdida/);

  const good = buildLines([working("D1", [[1, 1]], { sourceLang: "de" }, { manualPriceCents: 6000, manualCostCents: 4000 })], files, "es");
  assert.equal(good.blockers.length, 0);
  assert.equal(quotePayload(good)?.lines[0].supplierUnitCost, "40.00");
});

test("excluded documents never become lines; mixed source languages and price 0 block", () => {
  const out = working("D2", [[1, 2]], {}, { included: false, excludedReason: "DNI para identificarse", position: 1 });
  const r = buildLines([working("D1", [[1, 1]]), out], files, "es");
  assert.equal(r.lines.length, 1);
  assert.match(r.warnings.at(-1)!.detail, /DNI para identificarse/);

  const mixed = buildLines([working("D1", [[1, 1]]), working("D2", [[1, 2]], { sourceLang: "ar" }, { manualPriceCents: 4000, position: 1 })], files, "es");
  assert.ok(mixed.blockers.some((b) => /un presupuesto por par/.test(b.detail)));

  const zero = buildLines([working("D1", [[1, 1]], {}, { manualPriceCents: 0 })], files, "es");
  assert.match(zero.blockers[0].detail, /precio 0/);
});

test("no target language blocks; a document over several files carries no page range", () => {
  const none = buildLines([working("D1", [[1, 1]])], files, "");
  assert.ok(none.blockers.some((b) => /destino/.test(b.detail)));
  const multi = buildLines([working("D1", [[1, 1], [2, 1]])], files, "es");
  assert.equal(multi.lines[0].pageStart, null);
  assert.equal(multi.lines[0].sourceFileUrl, files[0].url);
});

test("bank statements: the bulk rule of the French tariff sees every included statement", () => {
  const docs = Array.from({ length: 5 }, (_, i) => working(`D${i + 1}`, [[1, i + 1]], { type: "bank_statement", category: "financial", typeLabelEs: "Extracto bancario" }, { position: i }));
  const r = buildLines(docs, files, "es");
  const bulk = priceFrToEs({ docType: "bank_statement", category: "financial", pages: 1, words: 200, apostille: false, apostilleOnSeparatePage: false, bankStatementsInQuote: 5 });
  assert.equal(bulk.kind, "priced");
  assert.ok(r.lines.every((l) => bulk.kind === "priced" && l.unitPriceCents === bulk.cents));
});
