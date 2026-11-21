import test from "node:test";
import assert from "node:assert/strict";
import { buildHilo, isLangQuestion, LOCAL_VACIO, progressSteps, type HiloLocal } from "../../../lib/entrada/hilo.ts";
import { HILO_T } from "../../../lib/entrada/hilo-i18n.ts";
import type { ClientView } from "../../../lib/entrada/view.ts";

type Lectura = NonNullable<ClientView["lectura"]>;
const view = (o: Partial<ClientView> = {}): ClientView => ({
  estado: "abierta", email: "ana@x.com", emailVerificado: true, archivos: [], lectura: null, sinJurado: null, plazo: { urgency: null, neededBy: null },
  organismo: null, pais: null, idiomas: { origen: "fr", destinos: ["es"] }, soloLectura: null, ...o,
});
const lectura = (o: Partial<Lectura> = {}): Lectura => ({ fase: "lista", loteUpdatedAt: "2026-11-19T10:00:00.000Z", editable: true, targetLang: "es", documentos: [], noIncluidos: [], preguntas: [], resumen: "", ...o });
const file = { id: "f", name: "testamento p1.png", url: "u", mimeType: "image/png", size: 1, pages: 1 };
const next = (v: ClientView | null, local: Partial<HiloLocal> = {}, editing: null | Parameters<typeof buildHilo>[0]["editing"] = null) =>
  buildHilo({ email: v?.email ?? null, view: v, local: { ...LOCAL_VACIO, ...local }, editing });

test("the thread starts with what the client wants: languages → files, no email until «he terminado → sí»", () => {
  assert.equal(next(null).ask?.kind, "origen", "document language first, no default");
  assert.equal(next(null, { origenDado: true }).ask?.kind, "destino");
  assert.equal(next(null, { origenDado: true, destinos: ["es"] }).ask?.kind, "archivos", "upload before any email");
  const anon = view({ email: null, emailVerificado: false, archivos: [file] });
  assert.equal(next(anon).ask?.kind, "archivos");
  assert.ok(!next(anon).messages.some((m) => m.kind === "pide_email"));
  assert.equal(next(anon, { terminado: true }).ask?.kind, "terminado");
  const sí = next(anon, { terminado: true, quiereLeer: true });
  assert.equal(sí.ask?.kind, "email");
  assert.ok(sí.messages.some((m) => m.kind === "pide_email"));
  const ids = next(view({ archivos: [file] }), { terminado: true, quiereLeer: true }).messages.map((m) => m.id);
  assert.ok(ids.indexOf("pide_origen") < ids.indexOf("pide_destino") && ids.indexOf("pide_destino") < ids.indexOf("pide_archivos") && ids.indexOf("pide_archivos") < ids.indexOf("pide_email"));
});

test("email given → code; the verification noticed by polling moves the thread on to the reading without a touch", () => {
  const sent = view({ emailVerificado: false, archivos: [file] });
  assert.equal(next(sent, { terminado: true, quiereLeer: true }).ask?.kind, "codigo");
  assert.equal(next({ ...sent, emailVerificado: true }, { terminado: true, quiereLeer: true }).ask?.kind, "leyendo");
  assert.equal(next(view({ archivos: [], estado: "abierta" }), { terminado: true }).ask?.kind, "archivos", "no files, nothing to finish");
  assert.equal(next(view({ archivos: [file], lectura: lectura({ fase: "leyendo" }) })).ask?.kind, "leyendo", "a reading already running (reload) continues");
});

test("after the reading: result, then each question in the thread, then date, place, summary", () => {
  const v = view({ estado: "leida", archivos: [file], lectura: lectura({ preguntas: ["¿Dónde lo vas a presentar?", "¿A qué idioma necesita la traducción?"] }) });
  const a = next(v);
  assert.ok(a.messages.some((m) => m.kind === "resultado"));
  assert.deepEqual(a.ask, { kind: "pregunta", index: 0, idioma: false });
  const b = next(v, { respuestas: { 0: "Consulado" } });
  assert.deepEqual(b.ask, { kind: "pregunta", index: 1, idioma: true }, "a language question is answered with the language picker");
  assert.equal(next(v, { respuestas: { 0: "x", 1: "francés" } }).ask?.kind, "plazo");
  assert.equal(next(v, { respuestas: { 0: "x", 1: "y" }, urgency: "DATE" }).ask?.kind, "plazo", "a date is needed for «para una fecha»");
  assert.equal(next(v, { respuestas: { 0: "x", 1: "y" }, urgency: "DATE", neededBy: "2026-12-01" }).ask?.kind, "lugar");
  assert.equal(next(v, { respuestas: { 0: "x", 1: "y" }, urgency: "ASAP", lugarHecho: true }).ask?.kind, "enviar");
});

test("tapping an answer reopens its question in place, also the languages after the reading", () => {
  const v = view({ estado: "leida", archivos: [file], lectura: lectura() });
  const local = { urgency: "ASAP" as const, lugarHecho: true };
  assert.equal(next(v, local).ask?.kind, "enviar");
  assert.equal(next(v, local, "destino").ask?.kind, "destino");
  assert.equal(next(v, local, "origen").ask?.kind, "origen");
  assert.equal(next(v, local, "plazo").ask?.kind, "plazo");
  const dest = next(v, local).messages.find((m) => m.id === "destino");
  assert.equal(dest && "editKey" in dest ? dest.editKey : null, "destino");
});

test("read-only entrada says why in the thread; sin jurado and sent close the thread", () => {
  const ro = next(view({ estado: "leida", archivos: [file], lectura: lectura({ editable: false }), soloLectura: "caso_existente" }));
  assert.ok(ro.messages.some((m) => m.kind === "solo_lectura"));
  const sj = next(view({ estado: "sin_jurado", sinJurado: { idioma: "griego", codigo: "el", maecUrl: "https://www.exteriores.gob.es" } }));
  assert.deepEqual([sj.messages.at(-1)?.kind, sj.ask], ["sin_jurado", null]);
  const sent = next(view({ estado: "confirmada", archivos: [file], lectura: lectura(), plazo: { urgency: "ASAP", neededBy: null } }));
  assert.deepEqual([sent.messages.at(-1)?.kind, sent.ask], ["enviado", null]);
});

test("progress never invents findings: files and pages it already counted, then the steps of the reading", () => {
  const steps = progressSteps([{ name: "a.pdf", pages: 4 }, { name: "b.png", pages: 1 }]);
  assert.deepEqual(steps[0], { kind: "inicio", files: 2, pages: 5 });
  assert.deepEqual(steps.map((s) => s.kind), ["inicio", "archivo", "archivo", "agrupar", "comprobar", "casi"]);
  assert.equal(progressSteps([{ name: "a", pages: null }])[0].kind === "inicio" && (progressSteps([{ name: "a", pages: null }])[0] as { pages: number | null }).pages, null);
  assert.equal(HILO_T.es.inicio(5, 7), "Estoy revisando tus 5 archivos (7 páginas)…");
});

test("language questions are detected in the five languages the reading may use", () => {
  assert.equal(isLangQuestion("El testamento ya está en español: ¿a qué idioma necesita la traducción?"), true);
  assert.equal(isLangQuestion("¿Para qué organismo es?"), false);
  assert.equal(isLangQuestion("¿Para qué trámite necesitas la traducción?"), false);
  assert.equal(isLangQuestion("¿Quieres traducirlo al inglés o al francés?"), true);
});

test("every thread string exists in the five languages", () => {
  const keys = Object.keys(HILO_T.es).sort();
  for (const l of ["fr", "en", "de", "pt"] as const) assert.deepEqual(Object.keys(HILO_T[l]).sort(), keys, l);
});
