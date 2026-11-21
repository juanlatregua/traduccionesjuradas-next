import test from "node:test";
import assert from "node:assert/strict";
import { entradaLeads, type EntradaParaLead } from "../../../lib/entrada/leads.ts";
import { selectLeadSla } from "../../../lib/lead-sla-core.ts";
import { planRecalculo } from "../../../lib/caso/sombra-plan.ts";
import { puedeCaso, esCasoEstado } from "../../../lib/caso/estados.ts";
import { HILO_T } from "../../../lib/entrada/hilo-i18n.ts";
import { OpenBody } from "../../../lib/entrada/api.ts";

const NOW = new Date("2026-11-19T12:00:00Z");
const entrada = (o: Partial<EntradaParaLead> = {}): EntradaParaLead => ({
  id: "e1", estado: "confirmada", casoId: "c1", email: "ana@x.com", phone9: null, nombre: "Ana", sourceLang: null, targetLang: "es", urgency: "ASAP", neededBy: null,
  createdAt: new Date(NOW.getTime() - 90 * 60e3), files: [{ name: "a.pdf", sha256: "h1" }, { name: "b.jpg", sha256: "h2" }, { name: "c.jpg", sha256: "h3" }], ...o,
});

test("(c) one entrada is one lead, linked to its caso; sin jurado and empty entradas are not leads", () => {
  const leads = entradaLeads([entrada(), entrada({ id: "e2", estado: "sin_jurado" }), entrada({ id: "e3", files: [] })]);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].sessionToken, "entrada:e1");
  assert.equal(leads[0].fileName, "3 archivos");
  assert.match(leads[0].link, /\/zona-traductor\/casos\/c1$/);
});

test("(c) lead-sla sees the entrada once and sends Juan to its caso (works with LECTURA_CONSTRUCTOR off)", () => {
  const docs = entradaLeads([entrada()]).map((d) => ({ ...d, estimatedWords: null, quoteAmount: null }));
  const out = selectLeadSla({ now: NOW, docs, inbound: [], solicitudes: [], quotes: [], paidOrders: [] });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].links, ["https://www.traduccionesjuradas.net/zona-traductor/casos/c1"]);
});

test("Juan 2: SIN_JURADO is its own closed state, not a loss, and can reopen", () => {
  assert.equal(esCasoEstado("SIN_JURADO"), true);
  assert.equal(puedeCaso("ABIERTO", "SIN_JURADO"), true);
  assert.equal(puedeCaso("SIN_JURADO", "ABIERTO"), true);
  assert.equal(puedeCaso("SIN_JURADO", "PERDIDO"), false);
  const plan = planRecalculo({ casoId: "c", estado: "SIN_JURADO", closedAt: null, pedidos: [], quotes: [], lprs: [{ status: "EXPIRED", createdAt: NOW } as never], ahora: NOW });
  assert.deepEqual([plan?.estado, plan?.closedAt], ["SIN_JURADO", "poner"]);
});

test("(a)(b) the open body keeps the ?p= preset and the client's language; unknown presets are refused", () => {
  const base = { email: "a@x.com", gdprConsent: true, marketingConsent: true };
  assert.equal(OpenBody.safeParse({ ...base, source: "uge-ce", lang: "fr" }).success, true);
  assert.equal(OpenBody.safeParse({ ...base, source: "spam" }).success, false);
  assert.equal(OpenBody.safeParse({ ...base, lang: "zz" }).success, false);
  for (const l of ["es", "fr", "en", "de", "pt"] as const) assert.match(HILO_T[l].resumenLectura(2, 1), /2/);
});

test("all (AVISO_NO_PRESUPUESTABLES): sin jurado y sin archivos entran, marcados", () => {
  const leads = entradaLeads([entrada(), entrada({ id: "e2", estado: "sin_jurado" }), entrada({ id: "e3", files: [] }), entrada({ id: "e4", estado: "prueba" })], { all: true });
  assert.equal(leads.length, 3);
  assert.equal(leads.find((l) => l.sessionToken === "entrada:e2")!.noJurado, true);
  assert.equal(leads.find((l) => l.sessionToken === "entrada:e3")!.hasFiles, false);
  const out = selectLeadSla({ now: NOW, docs: leads.map((d) => ({ ...d, estimatedWords: null, quoteAmount: null })), inbound: [], solicitudes: [], quotes: [], paidOrders: [], v2: true });
  assert.ok(out.some((l) => l.noPresupuestable !== null));
});
