import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildQuotePatchPayload,
  editFormFromQuote,
  editGateFor,
  editLineFor,
  attachAndApplyPrice,
  attachDecision,
  lockedRecheck,
  describeUnsavedChanges,
  pricedAttachOutcome,
  pricedAttachPlan,
  pricedAttachRefusal,
  frozenEditBlocked,
  isStaleEdit,
  mergedSavedPrices,
  patchPrecheck,
  patchRow,
  quoteLineAmounts,
  rowMargin,
  withBasisCost,
  STALE_EDIT_CODE,
  STALE_EDIT_ERROR,
  hydrateRows,
  matchAnalysis,
  patchLineFromQuoteLine,
  preferAnalysisRows,
  presupuestoPaginaUnicaOn,
  rowSignature,
  sessionKeysForExpediente,
  shippingBaseFor,
  type AnalysisDoc,
  type EditableLine,
  type EditableQuote,
} from "../../lib/quote-edit-hydrate.ts";
import { computeQuoteTotals, normalizeQuoteLines, paperShippingBase } from "../../lib/quotes.ts";
import { frozenSendBlocked, FROZEN_SEND_ERROR } from "../../lib/precio-tras-envio-math.ts";
import { quoteContentVersion } from "../../lib/quote-content-version.ts";

const URL_A = "https://abc.public.blob.vercel-storage.com/expedientes/a.pdf";
const URL_B = "https://abc.public.blob.vercel-storage.com/expedientes/b.pdf";

const LINES: EditableLine[] = [
  { description: "Acta de nacimiento (Francés→Español, 250 palabras)", quantity: 1, unitPrice: 42.5, supplierUnitCost: 30, sourceFileUrl: URL_A, pageStart: 1, pageEnd: 2, docKind: "birth_certificate" },
  { description: "Diploma (Francés→Español)", quantity: 1, unitPrice: 35, supplierUnitCost: null, sourceFileUrl: URL_A, pageStart: 3, pageEnd: 3, docKind: null },
  { description: "Extractos bancarios (15 documentos)", quantity: 15, unitPrice: 15.33, supplierUnitCost: 11.11, sourceFileUrl: URL_B, pageStart: null, pageEnd: null, docKind: "bank_statement" },
  { description: "Gestión urgente", quantity: 1, unitPrice: 19.99, supplierUnitCost: 0, sourceFileUrl: null, pageStart: null, pageEnd: null, docKind: null },
];

function quoteOf(over: Partial<EditableQuote> = {}): EditableQuote {
  const base: EditableQuote = {
    id: "q1",
    quoteNumber: "2026-00999",
    status: "SENT",
    customerName: "Cliente Prueba",
    customerEmail: "cliente@example.com",
    customerPhone: null,
    sourceLang: "fr",
    targetLang: "es",
    deliveryType: "PAPER_SHIP",
    shippingBase: 14,
    vatRate: 0.21,
    discountType: "PERCENT",
    discountValue: 7,
    notesLegal: "Notas",
    deliveryTerm: "2 días",
    holderNames: null,
    validityDays: 10,
    marginPct: 25,
    paymentMethods: ["sabadell", "revolut"],
    contactWhatsapp: null,
    pdfLang: null,
    paymentFrozenAt: null,
    version: "v1",
    total: 0,
    lines: LINES,
    ...over,
  };
  return base;
}

// Lo que hace el PATCH con el cuerpo: normalizeQuoteLines + computeQuoteTotals (route.ts).
function serverRecompute(body: ReturnType<typeof buildQuotePatchPayload>) {
  const parsed = normalizeQuoteLines(body.lines);
  assert.ok(parsed.ok);
  return computeQuoteTotals({
    lines: parsed.lines,
    discountType: body.discountType as any,
    discountValue: body.discountValue,
    vatRate: body.vatRate,
    deliveryType: body.deliveryType as any,
    shippingBase: body.deliveryType === "PAPER_SHIP" ? paperShippingBase(body.shippingBase) : 0,
  });
}

function storedTotals(q: EditableQuote) {
  return computeQuoteTotals({
    lines: q.lines.map((l) => ({ ...l, supplierUnitCost: l.supplierUnitCost ?? undefined, sourceFileUrl: l.sourceFileUrl ?? undefined, pageStart: l.pageStart ?? undefined, pageEnd: l.pageEnd ?? undefined, docKind: l.docKind ?? undefined })),
    discountType: q.discountType as any,
    discountValue: q.discountValue,
    vatRate: q.vatRate,
    deliveryType: q.deliveryType as any,
    shippingBase: q.deliveryType === "PAPER_SHIP" ? q.shippingBase : 0,
  });
}

// Composición de filas tocadas: una línea simple con el coste y precio de la fila.
const compose = (r: any) => ({ description: r.lineDescription ?? "x", quantity: 1, unitPrice: r.clientPrice, supplierUnitCost: r.unitPrice });

test("flag: solo PRESUPUESTO_PAGINA_UNICA=on exacto", () => {
  assert.equal(presupuestoPaginaUnicaOn({ PRESUPUESTO_PAGINA_UNICA: "on" }), true);
  for (const v of [undefined, "", "off", "ON", " on", "true", "1"]) assert.equal(presupuestoPaginaUnicaOn({ PRESUPUESTO_PAGINA_UNICA: v }), false, String(v));
});

test("estado → qué deja hacer", () => {
  assert.equal(editGateFor("DRAFT"), "draft");
  for (const s of ["SENT", "OPENED", "ACCEPTED"]) assert.equal(editGateFor(s), "live");
  for (const s of ["PAID", "IN_PROGRESS", "DELIVERED", "EXPIRED", "LOST", "CANCELLED", "ALGO"]) assert.equal(editGateFor(s), "readonly");
});

test("claves de sesión del expedienteRef", () => {
  assert.deepEqual(sessionKeysForExpediente("puerta:tok123"), ["tok123", "puerta:tok123"]);
  assert.deepEqual(sessionKeysForExpediente("REF9"), ["exp:REF9", "REF9"]);
  assert.deepEqual(sessionKeysForExpediente("exp:REF9"), ["exp:REF9", "REF9"]);
  assert.deepEqual(sessionKeysForExpediente(null), []);
});

test("una fila de análisis por URL: la de la sesión del presupuesto gana a una más reciente", () => {
  const rows = [
    { id: "old-own", fileUrl: URL_A, sessionToken: "tok", createdAt: new Date("2026-01-01") },
    { id: "new-other", fileUrl: URL_A, sessionToken: "otra", createdAt: new Date("2026-02-01") },
    { id: "b1", fileUrl: URL_B, sessionToken: null, createdAt: new Date("2026-01-01") },
    { id: "b2", fileUrl: URL_B, sessionToken: null, createdAt: new Date("2026-03-01") },
  ];
  const picked = preferAnalysisRows(rows, ["tok"]).map((r) => r.id).sort();
  assert.deepEqual(picked, ["b2", "old-own"]);
});

test("matchAnalysis: mismo PDF y rango; un único documento sin rango; si no, nada", () => {
  const docs: AnalysisDoc[] = [
    { fileUrl: URL_A, fileName: "a.pdf", pageStart: 1, pageEnd: 2, words: 250, documentTypeEs: "Acta de nacimiento" },
    { fileUrl: URL_A, fileName: "a.pdf", pageStart: 3, pageEnd: 3, words: 90 },
    { fileUrl: URL_B, fileName: "b.pdf", pageStart: 1, pageEnd: 15, words: 3000 },
  ];
  assert.equal(matchAnalysis(LINES[0], docs)?.words, 250);
  assert.equal(matchAnalysis(LINES[1], docs)?.words, 90);
  assert.equal(matchAnalysis(LINES[2], docs)?.words, 3000);
  assert.equal(matchAnalysis(LINES[3], docs), null);
  assert.equal(matchAnalysis({ ...LINES[0], pageStart: 1, pageEnd: 1 }, docs), null);
});

test("hydrate: filas con coste y precio TOTALES de la línea, texto tal cual y análisis", () => {
  const docs: AnalysisDoc[] = [{ fileUrl: URL_A, fileName: "a.pdf", pageStart: 1, pageEnd: 2, words: 250, pages: 2, documentType: "birth_certificate", documentTypeEs: "Acta de nacimiento", sourceLang: "fr", targetLang: "es", mode: "text" }];
  const rows = hydrateRows(LINES, docs);
  assert.equal(rows.length, 4);
  const [acta, diploma, extractos, manual] = rows;
  assert.equal(acta.status, "done");
  assert.equal(acta.words, 250);
  assert.equal(acta.fileName, "a.pdf · págs 1-2");
  assert.equal(acta.lineDescription, LINES[0].description);
  assert.equal(acta.unitPrice, 30);
  assert.equal(acta.clientPrice, 42.5);
  assert.equal(acta.autoPriced, false);
  assert.equal(acta.blobUrl, URL_A);
  assert.equal(diploma.status, "manual");
  assert.equal(diploma.unitPrice, 0);
  // El texto de la línea nunca se usa como nombre del documento (viaja a lavori).
  assert.equal(diploma.documentTypeEs, undefined);
  assert.equal(acta.documentTypeEs, "Acta de nacimiento");
  assert.equal(extractos.basis, "unit");
  assert.equal(extractos.unitCount, 15);
  assert.equal(extractos.unitRate, 11.11);
  assert.equal(extractos.unitPrice, 166.65);
  assert.equal(extractos.clientPrice, 229.95);
  // El efecto «por documento» del constructor recalcula así: no debe mover nada.
  assert.equal(Math.round(extractos.unitCount! * extractos.unitRate! * 100) / 100, extractos.unitPrice);
  assert.equal(manual.blobUrl, undefined);
  assert.equal(manual.mimeType, "");
  for (const r of rows) assert.equal(r.hydratedSig, rowSignature(r));
});

test("form desde el presupuesto: todo lo que el PATCH reescribe", () => {
  const f = editFormFromQuote(quoteOf({ customerPhone: "+34600000000", pdfLang: "fr" }));
  assert.equal(f.customerPhone, "+34600000000");
  assert.equal(f.discountType, "PERCENT");
  assert.equal(f.discountValue, 7);
  assert.equal(f.vatRate, 0.21);
  assert.equal(f.shippingBase, 14);
  assert.equal(f.marginPct, 25);
  assert.equal(f.pdfLang, "fr");
  assert.equal(f.validityDays, 10);
  assert.deepEqual(f.paymentMethods, ["sabadell", "revolut"]);
});

for (const [name, over] of [
  ["papel + descuento % + IVA 21", {}],
  ["descuento fijo + IVA 0 (extranjero) + digital", { discountType: "FIXED", discountValue: 12.5, vatRate: 0, deliveryType: "DIGITAL_PDF", shippingBase: 0 }],
  ["sin descuento + papel con base guardada 0 (recogida en mano)", { discountType: "NONE", discountValue: 0, shippingBase: 0 }],
  ["papel con envío de la jurada 19 €", { shippingBase: 19 }],
  ["margen auto (null)", { marginPct: null }],
] as const) {
  test(`ida y vuelta sin tocar nada: mismos totales, líneas, costes y margen (${name})`, () => {
    const q = quoteOf(over as Partial<EditableQuote>);
    const rows = hydrateRows(q.lines, []);
    const lines = rows.map((r) => editLineFor(r, () => assert.fail("una fila sin tocar no se recompone")));
    const body = buildQuotePatchPayload(editFormFromQuote(q), lines);
    const after = serverRecompute(body);
    const before = storedTotals(q);
    assert.equal(after.subtotal, before.subtotal);
    assert.equal(after.discountAmount, before.discountAmount);
    assert.equal(after.shippingAmount, before.shippingAmount);
    assert.equal(after.vatAmount, before.vatAmount);
    assert.equal(after.total, before.total);
    assert.deepEqual(after.lines.map((l) => [l.description, l.quantity, l.unitPrice, l.lineTotal, l.supplierUnitCost, l.sourceFileUrl, l.pageStart, l.pageEnd, l.docKind]),
      before.lines.map((l) => [l.description, l.quantity, l.unitPrice, l.lineTotal, l.supplierUnitCost, l.sourceFileUrl, l.pageStart, l.pageEnd, l.docKind]));
    // marginPct: el parser lo redondea; undefined → null, igual que estaba.
    assert.equal(body.marginPct ?? null, q.marginPct);
    assert.equal(body.vatRate, q.vatRate);
    assert.equal(body.discountType, q.discountType);
    assert.equal(body.pdfLang, q.pdfLang);
  });
}

test("coste null se conserva (no se vuelve 0 €) aunque la fila se toque sin ponerle coste", () => {
  const [, diploma] = hydrateRows(LINES, []);
  assert.equal(patchLineFromQuoteLine(LINES[1]).supplierUnitCost, undefined);
  const touched = { ...diploma, lineDescription: "Diploma universitario" };
  const out = editLineFor(touched, compose);
  assert.equal(out.description, "Diploma universitario");
  assert.equal("supplierUnitCost" in out, false);
  const withCost = { ...diploma, unitPrice: 20 };
  assert.equal(editLineFor(withCost, compose).supplierUnitCost, 20);
});

test("fila tocada: se recompone y el total cambia por donde toca", () => {
  const q = quoteOf();
  const rows = hydrateRows(q.lines, []);
  rows[0] = { ...rows[0], clientPrice: 50 };
  const lines = rows.map((r) => editLineFor(r, compose));
  assert.equal(lines[0].unitPrice, 50);
  assert.deepEqual(lines.slice(1), q.lines.slice(1).map(patchLineFromQuoteLine));
  const after = serverRecompute(buildQuotePatchPayload(editFormFromQuote(q), lines));
  assert.equal(after.subtotal, Math.round((storedTotals(q).subtotal + 7.5) * 100) / 100);
});

test("cuerpo del PATCH: mismo formato que QuoteEditForm + pdfLang/shippingBase; flags solo si se piden", () => {
  const q = quoteOf({ customerPhone: "  " });
  const body = buildQuotePatchPayload(editFormFromQuote(q), []);
  assert.equal(body.customerPhone, undefined);
  assert.equal(body.holderNames, null);
  assert.equal(body.contactWhatsapp, null);
  assert.equal(body.shippingBase, 14);
  assert.equal("overrideLowMargin" in body, false);
  assert.equal("frozenRepair" in body, false);
  const b2 = buildQuotePatchPayload(editFormFromQuote(q), [], { overrideLowMargin: true, frozenRepair: true });
  assert.equal(b2.overrideLowMargin, true);
  assert.equal(b2.frozenRepair, true);
  assert.equal(shippingBaseFor({ deliveryType: "DIGITAL_PDF", shippingBase: 14 }), 0);
  assert.equal(shippingBaseFor({ deliveryType: "PAPER_SHIP", shippingBase: 0 }), 0);
});

test("envío en papel: 0 explícito se respeta; falta o no-número → 12; digital → 0", () => {
  assert.equal(shippingBaseFor({ deliveryType: "PAPER_SHIP", shippingBase: 0 }), 0);
  assert.equal(shippingBaseFor({ deliveryType: "PAPER_SHIP", shippingBase: 19 }), 19);
  assert.equal(shippingBaseFor({ deliveryType: "PAPER_SHIP", shippingBase: 6 }), 6);
  assert.equal(shippingBaseFor({ deliveryType: "PAPER_SHIP", shippingBase: undefined as any }), 12);
  assert.equal(shippingBaseFor({ deliveryType: "PAPER_SHIP", shippingBase: NaN }), 12);
  assert.equal(shippingBaseFor({ deliveryType: "DIGITAL_PDF", shippingBase: 0 }), 0);
  assert.equal(paperShippingBase(null), 12);
  assert.equal(paperShippingBase(""), 12);
  assert.equal(paperShippingBase("abc"), 12);
  assert.equal(paperShippingBase(-5), 12);
  assert.equal(paperShippingBase("0"), 0);
  assert.equal(paperShippingBase("19.5"), 19.5);
  const paper = quoteOf({ deliveryType: "PAPER_SHIP", shippingBase: 0 });
  assert.equal(editFormFromQuote(paper).shippingBase, 0);
  assert.equal(buildQuotePatchPayload(editFormFromQuote(paper), []).shippingBase, 0);
  assert.equal(computeQuoteTotals({ lines: [{ description: "x", quantity: 1, unitPrice: 30 }], discountType: "NONE", discountValue: 0, vatRate: 0.21, deliveryType: "PAPER_SHIP", shippingBase: 0 }).shippingAmount, 0);
  assert.equal(editFormFromQuote(quoteOf({ deliveryType: "DIGITAL_PDF", shippingBase: 0 })).shippingBase, 12);
});

test("guarda de pago congelado: bloquea dinero sin frozenRepair; deja datos sin dinero y la reparación", () => {
  const current = { lines: [{ quantity: 1, unitPrice: "42.50", supplierUnitCost: "30.00" }], total: "51.43" };
  const same = { lines: [{ quantity: 1, unitPrice: 42.5, supplierUnitCost: 30 }], total: 51.43 };
  const newCost = { lines: [{ quantity: 1, unitPrice: 42.5, supplierUnitCost: 45 }], total: 51.43 };
  const newPrice = { lines: [{ quantity: 1, unitPrice: 60, supplierUnitCost: 45 }], total: 72.6 };
  const extraLine = { lines: [...same.lines, { quantity: 1, unitPrice: 0, supplierUnitCost: null }], total: 51.43 };
  assert.equal(frozenEditBlocked({ frozen: true, frozenRepair: false, current, next: same }), false);
  assert.equal(frozenEditBlocked({ frozen: true, frozenRepair: false, current, next: newCost }), true);
  assert.equal(frozenEditBlocked({ frozen: true, frozenRepair: false, current, next: newPrice }), true);
  assert.equal(frozenEditBlocked({ frozen: true, frozenRepair: false, current, next: extraLine }), true);
  assert.equal(frozenEditBlocked({ frozen: true, frozenRepair: true, current, next: newPrice }), false);
  assert.equal(frozenEditBlocked({ frozen: false, frozenRepair: false, current, next: newPrice }), false);
});

test("modo edición nunca crea: handleSubmit (POST) se corta y guardar es PATCH", () => {
  const src = readFileSync(new URL("../../components/StaffExpedienteIntake.tsx", import.meta.url), "utf8");
  const submit = src.indexOf("const handleSubmit = useCallback(async");
  assert.ok(submit > 0);
  assert.match(src.slice(submit, submit + 200), /if \(editQuote\) return;/);
  assert.equal(src.match(/fetch\("\/api\/quotes",/g)?.length, 1);
  assert.ok(src.indexOf('fetch("/api/quotes",') > submit);
  const save = src.indexOf("const saveEdit = async");
  const saveBody = src.slice(save, src.indexOf("const resendEdit", save));
  assert.match(saveBody, /fetch\(`\/api\/quotes\/\$\{editQuote\.id\}`/);
  assert.match(saveBody, /method: "PATCH"/);
  assert.doesNotMatch(saveBody, /method: "POST"/);
  assert.doesNotMatch(saveBody, /window\.confirm/);
});

test("flag apagado: la ficha y /editar siguen como hoy", () => {
  const ficha = readFileSync(new URL("../../app/zona-traductor/presupuestos/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(ficha, /const editarHref = paginaUnica \? "#editar" : `\/zona-traductor\/presupuestos\/\$\{params\.id\}\/editar`;/);
  assert.match(ficha, /const constructor = paginaUnica \? await constructorDelPresupuesto/);
  const editar = readFileSync(new URL("../../app/zona-traductor/presupuestos/[id]/editar/page.tsx", import.meta.url), "utf8");
  assert.match(editar, /if \(presupuestoPaginaUnicaOn\(\)\) \{\s*redirect\(/);
  assert.match(editar, /<QuoteEditForm /);
});

const MONEY = { lines: [{ quantity: 1, unitPrice: "42.50", supplierUnitCost: "30.00" }], total: "51.43" };
const MONEY_NEW = { lines: [{ quantity: 1, unitPrice: 42.5, supplierUnitCost: 45 }], total: 51.43 };
const pre = (over: Partial<Parameters<typeof patchPrecheck>[0]> = {}) =>
  patchPrecheck({ status: "SENT", version: "abc", expectedVersion: undefined, frozen: false, frozenRepair: false, current: MONEY, next: MONEY_NEW, ...over });

test("PATCH: versión obsoleta → 409 stale; sin versión, como siempre; misma versión pasa", () => {
  assert.equal(pre(), null);
  assert.equal(pre({ expectedVersion: "abc" }), null);
  const stale = pre({ expectedVersion: "otra" });
  assert.equal(stale?.status, 409);
  assert.equal(stale?.body.code, STALE_EDIT_CODE);
  assert.equal(stale?.body.error, STALE_EDIT_ERROR);
  assert.equal(isStaleEdit("", "abc"), false);
  assert.equal(isStaleEdit(null, "abc"), false);
});

const STORED = {
  customerName: "Cliente", customerEmail: "c@example.com", customerPhone: null, sourceLang: "fr", targetLang: "es",
  deliveryType: "DIGITAL_PDF", shippingBase: "0.00", vatRate: "0.2100", discountType: "NONE", discountValue: "0.00",
  notesLegal: null, deliveryTerm: "2 días", holderNames: null, validityDays: 15, marginPct: null, paymentMethods: ["sabadell"],
  contactWhatsapp: null, pdfLang: null, total: "51.43",
  lines: [{ description: "Acta", quantity: "1.00", unitPrice: "42.50", supplierUnitCost: "30.00", sourceFileUrl: URL_A, pageStart: 1, pageEnd: 2, docKind: null }],
};

test("versión de contenido: abrir /q, congelar o regenerar el PDF no cuentan; la cifra del jurado sí", () => {
  const v = quoteContentVersion(STORED);
  // Prisma da Decimal/strings; la página, números: misma versión.
  assert.equal(quoteContentVersion({ ...STORED, vatRate: 0.21, total: 51.43, lines: [{ ...STORED.lines[0], quantity: 1, unitPrice: 42.5, supplierUnitCost: 30 }] }), v);
  // Campos fuera del contenido (actividad del cliente, congelación, PDF, estado).
  assert.equal(quoteContentVersion({ ...STORED, status: "OPENED", openedAt: new Date(), paymentFrozenAt: new Date(), pdfUrl: "x", updatedAt: new Date() }), v);
  // Cifra del jurado en las líneas, total, idioma del PDF o plazo → otra versión.
  assert.notEqual(quoteContentVersion({ ...STORED, lines: [{ ...STORED.lines[0], supplierUnitCost: "45.00" }] }), v);
  assert.notEqual(quoteContentVersion({ ...STORED, total: "60.00" }), v);
  assert.notEqual(quoteContentVersion({ ...STORED, pdfLang: "fr" }), v);
  assert.notEqual(quoteContentVersion({ ...STORED, deliveryTerm: "3-4 días hábiles" }), v);
  assert.equal(pre({ version: v, expectedVersion: v }), null);
  assert.equal(pre({ version: quoteContentVersion({ ...STORED, lines: [{ ...STORED.lines[0], supplierUnitCost: "45.00" }] }), expectedVersion: v })?.body.code, STALE_EDIT_CODE);
});

test("qué se pierde al recargar: campos y líneas cambiados, nada si no hay cambios", () => {
  const q = quoteOf();
  const lines = q.lines.map(patchLineFromQuoteLine);
  const before = buildQuotePatchPayload(editFormFromQuote(q), lines);
  assert.deepEqual(describeUnsavedChanges(before, before), []);
  const after = buildQuotePatchPayload({ ...editFormFromQuote(q), deliveryTerm: "1 día" }, [{ ...lines[0], unitPrice: 50 }, ...lines.slice(1), { description: "Extra", quantity: 1, unitPrice: 10 }]);
  const out = describeUnsavedChanges(before, after);
  assert.equal(out.length, 3);
  assert.match(out[0], /^Plazo: 2 días → 1 día$/);
  assert.match(out[1], /^Línea 1: .*42\.50 €.* → .*50\.00 €/);
  assert.match(out[2], /^Línea nueva: Extra/);
});

test("solicitud reutilizada CON cifra: borrador → relleno; enviado → precio tras envío; si no, no se ata", () => {
  assert.equal(pricedAttachPlan("DRAFT"), "fill");
  for (const st of ["SENT", "OPENED", "ACCEPTED"]) assert.equal(pricedAttachPlan(st), "sent");
  for (const st of ["PAID", "EXPIRED", "LOST", "DELIVERED"]) assert.equal(pricedAttachPlan(st), "refuse");
  assert.equal(pricedAttachRefusal(9000), "ya tiene cifra 90,00 €: ponla en las líneas");
  // Borrador: relleno hecho → atada y dicho; relleno imposible → no atada y por qué.
  const fillOk = pricedAttachOutcome("fill", { ok: true }, 9000);
  assert.equal(fillOk.atada, true);
  assert.match(fillOk.aplicado!, /90,00 €.*borrador/);
  const fillKo = pricedAttachOutcome("fill", { ok: false, reason: "el borrador tiene líneas con cantidad distinta de 1: repártelo tú" }, 9000);
  assert.equal(fillKo.atada, false);
  assert.match(fillKo.motivo!, /^ya tiene cifra 90,00 €: ponla en las líneas \(el borrador tiene líneas/);
  // Enviado: coste escrito / congelado por pérdida / no manejado.
  assert.match(pricedAttachOutcome("sent", { ok: true, written: true }, 9000).aplicado!, /ya está como coste en las líneas/);
  // Manejada sin repartir el coste: nunca dice que ya está en las líneas.
  const sinReparto = pricedAttachOutcome("sent", { ok: true }, 9000).aplicado!;
  assert.doesNotMatch(sinReparto, /ya está como coste/);
  assert.match(sinReparto, /NO se ha repartido en las líneas: repártelo tú/);
  assert.match(pricedAttachOutcome("sent", { ok: true, unchanged: true }, 9000).aplicado!, /coincide con el coste/);
  assert.match(pricedAttachOutcome("sent", { ok: true, frozen: true }, 9000).aplicado!, /CONGELADO/);
  assert.equal(pricedAttachOutcome("sent", { ok: false, reason: "presupuesto pagado" }, 9000).atada, false);
  assert.equal(pricedAttachOutcome("refuse", null, 9000).atada, false);
});

test("PATCH: congelado sin reparación → 409; con reparación pasa; estado no editable → 400 antes que nada", () => {
  const frozen = pre({ frozen: true });
  assert.equal(frozen?.status, 409);
  assert.equal(frozen?.body.code, "PAGO_CONGELADO");
  assert.equal(frozen?.body.error, "Pago congelado: descongela antes de editar");
  assert.equal(pre({ frozen: true, frozenRepair: true }), null);
  assert.equal(pre({ frozen: true, next: { lines: [{ quantity: 1, unitPrice: 42.5, supplierUnitCost: 30 }], total: 51.43 } }), null);
  // Obsoleto gana a congelado: primero hay que ver la versión actual.
  assert.equal(pre({ frozen: true, expectedVersion: "vieja" })?.body.code, STALE_EDIT_CODE);
  assert.equal(pre({ status: "PAID" })?.status, 400);
});

test("reenvío / envío rechazado con el pago congelado", () => {
  assert.equal(frozenSendBlocked({ paymentFrozenAt: new Date() }), FROZEN_SEND_ERROR);
  assert.equal(FROZEN_SEND_ERROR, "Pago congelado: descongela antes de reenviar");
  assert.equal(frozenSendBlocked({ paymentFrozenAt: null }), null);
});

test("solicitud lavori: atada en la rama nueva y en la de reutilizar; si no, por qué", () => {
  const q = { par: "FR>ES", editable: true };
  // Nueva (sin quoteId) del mismo par → se ata.
  assert.deepEqual(attachDecision({ anchorQuoteId: "q1", lpr: { quoteId: null, par: "FR>ES" }, quote: q }), { atar: true, atada: true });
  // Reutilizada ya atada a este presupuesto → atada sin escribir.
  assert.deepEqual(attachDecision({ anchorQuoteId: "q1", lpr: { quoteId: "q1", par: "FR>ES" }, quote: q }), { atar: false, atada: true });
  // Reutilizada suelta del mismo par → se ata.
  assert.equal(attachDecision({ anchorQuoteId: "q1", lpr: { quoteId: null, par: "fr>es" }, quote: q }).atar, true);
  // Reutilizada de otro presupuesto → no.
  const otro = attachDecision({ anchorQuoteId: "q1", lpr: { quoteId: "q2", par: "FR>ES" }, quote: q });
  assert.equal(otro.atada, false);
  assert.match(otro.motivo!, /otro presupuesto/);
  // Par cambiado sin guardar → «guarda primero».
  const par = attachDecision({ anchorQuoteId: "q1", lpr: { quoteId: null, par: "EN>ES" }, quote: q });
  assert.equal(par.atar, false);
  assert.match(par.motivo!, /guarda primero/);
  assert.equal(attachDecision({ anchorQuoteId: "q1", lpr: { quoteId: null, par: "FR>ES" }, quote: { par: "FR>ES", editable: false } }).atada, false);
  assert.deepEqual(attachDecision({ anchorQuoteId: null, lpr: { quoteId: null, par: "FR>ES" }, quote: q }), { atar: false, atada: false });
});

test("cambiar el coste de una fila guardada conserva el precio al cliente (crear: como siempre)", () => {
  const [acta, , extractos] = hydrateRows(LINES, []);
  const edited = patchRow(acta, { unitPrice: 38, clientPrice: undefined, autoPriced: false }, true);
  assert.equal(edited.clientPrice, 42.5);
  assert.equal(edited.unitPrice, 38);
  const line = editLineFor(edited, (r) => ({ description: r.lineDescription!, ...quoteLineAmounts({ basis: r.basis, unitCount: r.unitCount, clientPrice: r.clientPrice!, cost: r.unitPrice }) }));
  assert.deepEqual([line.quantity, line.unitPrice, line.supplierUnitCost], [1, 42.5, 38]);
  // Crear: el coste nuevo deja el precio en manos del margen.
  assert.equal(patchRow({ ...acta, origLine: undefined }, { unitPrice: 38 }, false).clientPrice, undefined);
  assert.equal(patchRow(acta, { unitPrice: 38 }, false).clientPrice, undefined);
  // Recalcular es explícito: el precio que se pasa manda.
  assert.equal(patchRow(acta, { clientPrice: 47.5 }, true).clientPrice, 47.5);
  // Por documento: cambiar la tarifa recalcula el coste y conserva el precio.
  const rate = patchRow(extractos, { unitRate: 12, unitPrice: 180 }, true);
  const recost = withBasisCost(rate, 180, true);
  assert.equal(recost.clientPrice, 229.95);
  const l2 = quoteLineAmounts({ basis: recost.basis, unitCount: recost.unitCount, clientPrice: recost.clientPrice!, cost: recost.unitPrice });
  assert.deepEqual(l2, { quantity: 15, unitPrice: 15.33, supplierUnitCost: 12 });
  assert.equal(withBasisCost({ ...extractos, origLine: undefined }, 180, true).clientPrice, undefined);
});

test("margen de la fila: bajo por debajo del mínimo; sin coste no se juzga", () => {
  assert.equal(rowMargin(42.5, 30).low, false);
  assert.equal(rowMargin(42.5, 40).low, true);
  assert.equal(rowMargin(30, 30).low, true);
  assert.equal(rowMargin(35, 0).low, false);
});

test("unir dos líneas guardadas suma precio y coste", () => {
  const [acta, diploma] = hydrateRows(LINES, []);
  const m = mergedSavedPrices(acta, diploma, acta.clientPrice, diploma.clientPrice);
  assert.equal(m.clientPrice, 77.5);
  assert.equal(m.unitPrice, 30);
  assert.equal(m.basis, undefined);
});

function fakeDeps(over: { status?: string; par?: string; before?: number | null; after?: number | null; leadQuoteId?: string | null; fill?: any; sent?: any } = {}) {
  const calls: string[] = [];
  let attached = false;
  const deps = {
    readQuote: async () => ({ status: over.status ?? "DRAFT", par: over.par ?? "FR>ES" }),
    readLead: async () => ({ id: "lpr1", quoteId: attached ? "q1" : over.leadQuoteId ?? null, par: "FR>ES", priceCents: attached ? (over.after !== undefined ? over.after : over.before ?? null) : over.before ?? null }),
    attach: async () => { calls.push("attach"); attached = true; return true; },
    detach: async () => { calls.push("detach"); attached = false; },
    fill: async () => { calls.push("fill"); return over.fill ?? { ok: true }; },
    sent: async () => { calls.push("sent"); return over.sent ?? { handled: true, frozen: false, written: true }; },
  };
  return { deps, calls };
}

test("atar: la solicitud devuelta por la guarda de duplicados con cifra → se aplica (borrador)", async () => {
  const { deps, calls } = fakeDeps({ before: 9000 });
  const r = await attachAndApplyPrice(deps, "q1", "26_ABC");
  assert.deepEqual(calls, ["attach", "fill"]);
  assert.equal(r.atada, true);
  assert.match(r.cifraAplicada!, /90,00 €.*borrador/);
});

test("atar: la cifra llega entre la lectura y el atado → se relee y se aplica (enviado)", async () => {
  const { deps, calls } = fakeDeps({ status: "SENT", before: null, after: 9000, sent: { handled: true, frozen: false, written: false } });
  const r = await attachAndApplyPrice(deps, "q1", "26_ABC");
  assert.deepEqual(calls, ["attach", "sent"]);
  assert.equal(r.atada, true);
  assert.match(r.cifraAplicada!, /NO se ha repartido/);
});

test("atar: sin cifra solo se ata; cifra imposible de aplicar → se desata y se dice", async () => {
  const sin = fakeDeps({ before: null, after: null });
  assert.deepEqual(await attachAndApplyPrice(sin.deps, "q1", "r"), { quoteId: "q1", atada: true });
  assert.deepEqual(sin.calls, ["attach"]);
  const ko = fakeDeps({ before: 9000, fill: { ok: false, reason: "hay otra solicitud con precio atada a este presupuesto: repártelo tú" } });
  const r = await attachAndApplyPrice(ko.deps, "q1", "r");
  assert.deepEqual(ko.calls, ["attach", "fill", "detach"]);
  assert.equal(r.atada, false);
  assert.match(r.motivoNoAtada!, /^ya tiene cifra 90,00 €: ponla en las líneas/);
  const sentKo = fakeDeps({ status: "OPENED", before: 9000, sent: { handled: false, reason: "presupuesto pagado entre la lectura y la escritura" } });
  assert.equal((await attachAndApplyPrice(sentKo.deps, "q1", "r")).atada, false);
  assert.deepEqual(sentKo.calls, ["attach", "sent", "detach"]);
  // Ya atada a este presupuesto: ni se ata ni se aplica otra vez.
  const ya = fakeDeps({ before: 9000, leadQuoteId: "q1" });
  assert.deepEqual(await attachAndApplyPrice(ya.deps, "q1", "r"), { quoteId: "q1", atada: true });
  assert.deepEqual(ya.calls, []);
  // Presupuesto pagado: no se ata.
  const paid = fakeDeps({ status: "PAID", before: 9000 });
  assert.equal((await attachAndApplyPrice(paid.deps, "q1", "r")).atada, false);
  assert.deepEqual(paid.calls, []);
});

test("PATCH bajo el candado: pagado entre medias → 400; versión cambiada → 409; si no, sigue", () => {
  assert.equal(lockedRecheck({ status: "PAID", version: "a", expectedVersion: "a" })?.status, 400);
  assert.equal(lockedRecheck({ status: "EXPIRED", version: "a", expectedVersion: undefined })?.status, 400);
  assert.equal(lockedRecheck({ status: "SENT", version: "b", expectedVersion: "a" })?.body.code, STALE_EDIT_CODE);
  assert.equal(lockedRecheck({ status: "SENT", version: "b", expectedVersion: undefined }), null);
  assert.equal(lockedRecheck({ status: "DRAFT", version: "a", expectedVersion: "a" }), null);
});
