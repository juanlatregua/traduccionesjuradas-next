import test from "node:test";
import assert from "node:assert/strict";
import {
  ENCARGO_CERRADO_JURADOS,
  closedCostFor,
  closedQuoteLines,
  closedRetireWhere,
  closedDeliveryTerm,
  encargoCerradoLangs,
  evaluateClosedQuote,
  isEncargoCerradoAutosend,
  isEncargoCerradoQuote,
  medianPlazoDias,
  isClosedCostExempt,
  unsealOnLineEdit,
  shouldRetireBeforeClosedSend,
  langsWithCollaborator,
} from "../../lib/encargo-cerrado-math.ts";

const doc = (docType: string, words: number | null, extra: Partial<{ apostille: boolean; label: string; pages: number | null; combined: boolean }> = {}) => ({
  docType,
  words,
  apostille: extra.apostille ?? false,
  label: extra.label ?? null,
  pages: extra.pages === undefined ? 1 : extra.pages,
  combined: extra.combined ?? false,
});

test("flag apagado = comportamiento de siempre", () => {
  for (const v of [undefined, null, "", "off", "OFF", "none"]) assert.equal(encargoCerradoLangs(v).size, 0);
  assert.deepEqual([...encargoCerradoLangs("pt, EN,de,fr,nl")].sort(), ["de", "en", "pt"]);
  assert.equal(isEncargoCerradoAutosend(undefined), false);
  assert.equal(isEncargoCerradoAutosend("off"), false);
  assert.equal(isEncargoCerradoAutosend("on"), true);
});

test("jurados: PT Cristina (no Nielson ni Juan Amor), EN Lourdes, DE Morton", () => {
  assert.equal(ENCARGO_CERRADO_JURADOS.pt.miembroId, "nhucqnd3q4znddxhe8qs5c51");
  assert.equal(ENCARGO_CERRADO_JURADOS.en.miembroId, "exwzhhwv5fyegllvblt76uvb");
  assert.equal(ENCARGO_CERRADO_JURADOS.de.miembroId, "ngus1uku6x5uw2pqbmflpbbt");
});

test("PT>ES documento suelto: max(40 €, 0,09 €/pal.)", () => {
  const r1 = closedCostFor("pt", "es", [doc("birth_certificate", 300)]);
  assert.ok(r1.ok);
  assert.deepEqual(r1.costs, [4000]);
  const r2 = closedCostFor("pt", "es", [doc("transcript", 1000)]);
  assert.ok(r2.ok);
  assert.deepEqual(r2.costs, [9000]);
  assert.equal(closedCostFor("pt", "es", [doc("degree", null)]).ok, false);
});

test("PT>ES caso 2026-00413 (Sergio, 5 docs, 5278 pal.): 0,058 €/pal. sobre el total = coste de las líneas", () => {
  const r = closedCostFor("pt", "es", [doc("degree", 760), doc("transcript", 1750), doc("degree", 800, { apostille: true }), doc("transcript", 1500), doc("degree", 468)]);
  assert.ok(r.ok);
  assert.equal(r.miembroId, "nhucqnd3q4znddxhe8qs5c51");
  assert.deepEqual(r.costs, [4408, 10150, 4640, 8700, 2714]);
  assert.equal(r.costs.reduce((a, c) => a + c, 0), 30612);
  const v = evaluateClosedQuote(closedQuoteLines(r.costs));
  assert.ok(v.ok);
  assert.equal(v.overCap, true, "más de 300 € netos: nunca sale solo");
});

test("PT>ES lote ≤4000 pal.: cada documento con su regla suelta", () => {
  const r = closedCostFor("pt", "es", [doc("degree", 300), doc("transcript", 1200)]);
  assert.ok(r.ok);
  assert.deepEqual(r.costs, [4000, 10800]);
});

test("ES>PT, ES>EN, ES>DE: sin regla", () => {
  assert.equal(closedCostFor("es", "pt", [doc("birth_certificate", 300)]).ok, false);
  assert.equal(closedCostFor("es", "en", [doc("birth_certificate", 300)]).ok, false);
  assert.equal(closedCostFor("es", "de", [doc("criminal_record", 300)]).ok, false);
  assert.equal(closedCostFor("nl", "es", [doc("birth_certificate", 300)]).ok, false);
});

test("EN>ES: 35 € solo documento corto suelto", () => {
  const ok = closedCostFor("en", "es", [doc("birth_certificate", 400)]);
  assert.ok(ok.ok);
  assert.deepEqual(ok.costs, [3500]);
  assert.ok(closedCostFor("en", "es", [doc("other", 200, { label: "UK driving licence" })]).ok);
  assert.equal(closedCostFor("en", "es", [doc("birth_certificate", 751)]).ok, false, "largo");
  assert.equal(closedCostFor("en", "es", [doc("birth_certificate", 300), doc("passport", 100)]).ok, false, "lote");
  assert.equal(closedCostFor("en", "es", [doc("contract", 300)]).ok, false, "no es corto");
  assert.equal(closedCostFor("en", "es", [doc("other", 300)]).ok, false);
  assert.equal(closedCostFor("en", "es", [doc("degree", null)]).ok, false, "sin conteo");
});

test("DE>ES: solo la lista de Morton; nunca por palabra", () => {
  const penal = closedCostFor("de", "es", [doc("criminal_record", 200)]);
  assert.ok(penal.ok);
  assert.deepEqual(penal.costs, [1500]);
  const penalApost = closedCostFor("de", "es", [doc("criminal_record", 400, { apostille: true })]);
  assert.ok(penalApost.ok);
  assert.deepEqual(penalApost.costs, [2500], "penal DE con apostilla = 25 € (pedido 26_7C2D6A)");
  const ids = closedCostFor("de", "es", [doc("id_card", 80), doc("passport", 900), doc("other", 120, { label: "Permiso de conducir alemán (Führerschein)" })]);
  assert.ok(ids.ok);
  assert.deepEqual(ids.costs, [1000, 1000, 1000], "el coste no cambia con las palabras");
  assert.equal(closedCostFor("de", "es", [doc("criminal_record", 200), doc("contract", 300)]).ok, false, "un documento fuera de lista = todo a ciegas");
  assert.equal(closedCostFor("de", "es", [doc("birth_certificate", 200)]).ok, false);
  assert.equal(closedCostFor("de", "es", [doc("criminal_record", 1500)]).ok, false);
});

test("precio al cliente: autoClientPriceFromCost (suelo 40 €) o tarifa aprobada, nunca bajo la regla", () => {
  const [l] = closedQuoteLines([3500]);
  assert.equal(l.clientCents, 4600);
  const [t] = closedQuoteLines([3500], [6000]);
  assert.equal(t.clientCents, 6000, "manda la tarifa aprobada");
  const [baja] = closedQuoteLines([3500], [3000]);
  assert.equal(baja.clientCents, 4600, "una tarifa por debajo del mínimo no baja el precio");
  const [de] = closedQuoteLines([1500]);
  assert.equal(de.clientCents, 4000);
});

test("freno de margen: <10 % o sin coste no pasa", () => {
  assert.equal(evaluateClosedQuote([{ clientCents: 4000, costCents: 3800 }]).ok, false);
  assert.equal(evaluateClosedQuote([{ clientCents: 4000, costCents: 0 }]).ok, false);
  assert.equal(evaluateClosedQuote([{ clientCents: 4000, costCents: 4000 }]).ok, false);
  assert.equal(evaluateClosedQuote([]).ok, false);
  const ok = evaluateClosedQuote(closedQuoteLines([3500]));
  assert.ok(ok.ok);
  assert.equal(ok.overCap, false);
});

test("plazo: mediana de los plazos del jurado; reserva con <3 muestras", () => {
  assert.equal(medianPlazoDias([1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3, 4, 6, 7], 5), 2, "Lourdes");
  assert.equal(medianPlazoDias([2, 2, 2, 2, 2, 2, 3], 5), 2, "Cristina");
  assert.equal(medianPlazoDias([1, 3], 2), 2);
  assert.equal(medianPlazoDias([null, 0, 4], 2), 2);
  assert.equal(medianPlazoDias([1, 2, 3, 4], 9), 3);
  assert.equal(closedDeliveryTerm(2), "2-3 días hábiles");
});

test("anti-duplicado al pagar: retira SENT/PRICED del mismo caso y par (00413: LEAD-4DA27E5651 viva)", () => {
  assert.equal(isEncargoCerradoQuote("encargo-cerrado"), true);
  assert.equal(isEncargoCerradoQuote("regla-cristina-0,058"), true);
  for (const v of ["tarifario", "lavori-directo", null, ""]) assert.equal(isEncargoCerradoQuote(v), false);
  const w = closedRetireWhere({ id: "q1", casoId: "cmwnffm72000pl208101b9y5x", expedienteRef: "LEAD-4DA27E5651" }, "PT>ES");
  assert.equal(w.par, "PT>ES");
  assert.deepEqual(w.status.in, ["SENT", "PRICED"], "ACCEPTED no se retira: lo frena el guarda de duplicado");
  assert.deepEqual(w.OR, [{ quoteId: "q1" }, { casoId: "cmwnffm72000pl208101b9y5x" }, { expedienteRef: "LEAD-4DA27E5651" }, { ref: "LEAD-4DA27E5651" }]);
  assert.deepEqual(closedRetireWhere({ id: "q2", casoId: null, expedienteRef: null }, "EN>ES").OR, [{ quoteId: "q2" }]);
});

test("revisión: un borrador editado pierde el sello y ya no manda encargo cerrado", () => {
  const antes = [{ quantity: 1, unitPrice: 52.9, supplierUnitCost: 44.08, sourceFileUrl: "a" }];
  assert.equal(unsealOnLineEdit("encargo-cerrado", antes, [{ quantity: "1", unitPrice: "52.90", supplierUnitCost: "44.08", sourceFileUrl: "a" }]), null, "guardar sin cambiar líneas no quita nada");
  const sin = unsealOnLineEdit("regla-cristina-0,058", antes, [{ quantity: 1, unitPrice: 52.9, supplierUnitCost: 30, sourceFileUrl: "a" }]);
  assert.deepEqual(sin, { autoPricedBy: null, lavoriMiembroId: null, lavoriMiembroNombre: null });
  assert.equal(isEncargoCerradoQuote(sin!.autoPricedBy), false);
  assert.ok(unsealOnLineEdit("encargo-cerrado", antes, [...antes, { quantity: 1, unitPrice: 10, supplierUnitCost: 5, sourceFileUrl: "b" }]));
  assert.equal(unsealOnLineEdit("tarifario", antes, []), null, "otras marcas no se tocan aquí");
});

test("revisión: exención de procedencia exige coste en TODAS las líneas", () => {
  const base = { sourceLang: "en", targetLang: "es", autoPricedBy: "encargo-cerrado" };
  assert.equal(isClosedCostExempt({ ...base, lines: [{ supplierUnitCost: 35 }] }), true);
  assert.equal(isClosedCostExempt({ ...base, lines: [{ supplierUnitCost: 35 }, { supplierUnitCost: 0 }] }), false, "una línea a 0 € deja de estar exenta");
  assert.equal(isClosedCostExempt({ ...base, lines: [] }), false);
  assert.equal(isClosedCostExempt({ sourceLang: "en", targetLang: "es", autoPricedBy: null, lines: [{ supplierUnitCost: 35 }] }), false);
  assert.equal(isClosedCostExempt({ sourceLang: "pt", targetLang: "es", lines: [{ supplierUnitCost: 40 }, { supplierUnitCost: null }] }), false);
});

test("revisión: no se retira nada si el encargo ya salió o lo lleva un traductor externo", () => {
  assert.equal(shouldRetireBeforeClosedSend({ events: [] }), true);
  assert.equal(shouldRetireBeforeClosedSend({ events: [{ type: "lavori.solicitud_enviada" }] }), false);
  assert.equal(shouldRetireBeforeClosedSend({ events: [], translatorName: "Fulana" }), false);
  assert.equal(shouldRetireBeforeClosedSend({ events: [{ type: "lavori.precio_aceptado_enviado" }], translatorName: " " }), true);
});

test("revisión: lecturas dudosas EN/DE (sin palabras, >2 págs, PDF combinado, carnet por nombre de archivo)", () => {
  assert.equal(closedCostFor("en", "es", [doc("birth_certificate", 300, { pages: 3 })]).ok, false);
  assert.equal(closedCostFor("en", "es", [doc("birth_certificate", 300, { pages: null })]).ok, false);
  assert.equal(closedCostFor("de", "es", [doc("criminal_record", null)]).ok, false);
  assert.equal(closedCostFor("de", "es", [doc("criminal_record", 300, { pages: 3 })]).ok, false);
  assert.equal(closedCostFor("de", "es", [doc("criminal_record", 600, { combined: true })]).ok, false, "penal + pasaporte + apostilla en un PDF");
  assert.equal(closedCostFor("de", "es", [doc("expediente_combinado", 600)]).ok, false);
  const conNombre = { ...doc("other", 100), fileName: "fuehrerschein.pdf" };
  assert.equal(closedCostFor("de", "es", [conNombre]).ok, false, "el nombre de archivo no cuenta");
  assert.equal(closedCostFor("pt", "es", [doc("transcript", 3000, { pages: 9 })]).ok, true, "PT sigue por palabra");
});

test("revisión: DE apostilla una sola vez; EN con apostilla va a borrador", () => {
  const r = closedCostFor("de", "es", [doc("criminal_record", 300, { apostille: true }), doc("apostille", 80)]);
  assert.ok(r.ok);
  assert.deepEqual(r.costs, [1500, 1000]);
  assert.equal(closedCostFor("en", "es", [doc("birth_certificate", 300, { apostille: true })]).ok, false);
});

test("revisión: más de 10 documentos no va por la regla", () => {
  assert.equal(closedCostFor("pt", "es", Array.from({ length: 11 }, () => doc("degree", 400))).ok, false);
  assert.ok(closedCostFor("pt", "es", Array.from({ length: 10 }, () => doc("degree", 400))).ok);
});

test("revisión: sin Collaborator del jurado la lengua no se activa (Cristina hoy)", () => {
  const { activas, sinAlta } = langsWithCollaborator(encargoCerradoLangs("pt,en,de"), {
    exwzhhwv5fyegllvblt76uvb: "info@lyltraduccionesprofesionales.com",
    ngus1uku6x5uw2pqbmflpbbt: "morton.muenster@gmx.de",
  });
  assert.deepEqual([...activas].sort(), ["de", "en"]);
  assert.deepEqual(sinAlta, ["pt"]);
  assert.equal(isEncargoCerradoQuote("regla-otra-cosa"), false, "lista exacta, no prefijo");
});
