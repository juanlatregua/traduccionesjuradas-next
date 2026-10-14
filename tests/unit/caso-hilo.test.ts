import test from "node:test";
import assert from "node:assert/strict";
import { decidirSolicitud, vivasDelPar, presupuestoDelHilo, esBorradorSustituible, type LprDelHilo, type QuoteDelHilo } from "../../lib/caso/hilo.ts";
import { repartirCosteLead } from "../../lib/caso/coste-lead.ts";
import { separarPorCaso, type OpenSibling } from "../../lib/open-siblings.ts";

const AHORA = new Date("2026-10-14T12:00:00Z");
const hace = (d: number) => new Date(AHORA.getTime() - d * 864e5);
const lpr = (o: Partial<LprDelHilo>): LprDelHilo => ({
  id: o.ref || "x",
  ref: "LEAD-A",
  par: "ES>IT",
  status: "SENT",
  priceCents: null,
  quoteId: null,
  createdAt: hace(1),
  ...o,
});

test("solicitud: sin viva del par se crea; con viva se reutiliza (nunca otra)", () => {
  assert.deepEqual(decidirSolicitud({ lprs: [], par: "ES>IT", ahora: AHORA }), { accion: "crear" });
  const viva = lpr({ ref: "LEAD-B49ADA6E30", status: "PRICED", priceCents: 12000 });
  const d = decidirSolicitud({ lprs: [viva], par: "es->it", ahora: AHORA });
  assert.equal(d.accion, "reutilizar");
  assert.equal(d.accion === "reutilizar" && d.viva.ref, "LEAD-B49ADA6E30");
});

test("solicitud: otro par, retirada o caducada no cuentan", () => {
  const lprs = [lpr({ par: "IT>ES" }), lpr({ status: "RETIRED" }), lpr({ status: "DISCARDED" }), lpr({ createdAt: hace(40) })];
  assert.deepEqual(decidirSolicitud({ lprs, par: "ES>IT", ahora: AHORA }), { accion: "crear" });
});

test("solicitud: entre varias vivas manda la que tiene jurado/cifra, luego la más reciente", () => {
  const lprs = [lpr({ ref: "N", createdAt: hace(0.1) }), lpr({ ref: "P", status: "PRICED", createdAt: hace(2) }), lpr({ ref: "A", status: "ACCEPTED", createdAt: hace(3) })];
  assert.deepEqual(vivasDelPar(lprs, "ES>IT", AHORA).map((l) => l.ref), ["A", "P", "N"]);
});

test("volver a pedir: retira todas las vivas del par y hereda el presupuesto", () => {
  const lprs = [lpr({ ref: "A", quoteId: "q1" }), lpr({ ref: "B", status: "PRICED" }), lpr({ ref: "C", par: "ES>EN" })];
  const d = decidirSolicitud({ lprs, par: "ES>IT", ahora: AHORA, volverAPedir: true });
  assert.equal(d.accion, "reemplazar");
  if (d.accion !== "reemplazar") return;
  assert.deepEqual(d.retirar.map((l) => l.ref).sort(), ["A", "B"]);
  assert.equal(d.quoteId, "q1");
  assert.deepEqual(decidirSolicitud({ lprs: [], par: "ES>IT", ahora: AHORA, volverAPedir: true }), { accion: "crear" });
});

test("volver a pedir mientras se retira: esperar", () => {
  const d = decidirSolicitud({ lprs: [lpr({ status: "RETIRING" })], par: "ES>IT", ahora: AHORA, volverAPedir: true });
  assert.equal(d.accion, "esperar");
});

const q = (o: Partial<QuoteDelHilo>): QuoteDelHilo => ({
  id: "q",
  status: "SENT",
  deletedAt: null,
  lostReason: null,
  lostReasonNote: null,
  liveCasoKey: null,
  supersededAt: null,
  expiredAt: null,
  createdAt: hace(1),
  ...o,
});

test("presupuesto del hilo: la vigente primero; borrado, perdido a mano, pagado o caducado no", () => {
  assert.equal(presupuestoDelHilo([q({ id: "a" }), q({ id: "b", liveCasoKey: "C1", createdAt: hace(5) })], "C1")?.id, "b");
  assert.equal(presupuestoDelHilo([q({ id: "a", createdAt: hace(3) }), q({ id: "b", createdAt: hace(1) })], "C1")?.id, "b");
  assert.equal(
    presupuestoDelHilo(
      [q({ deletedAt: hace(1) }), q({ lostReason: "PRICE", lostReasonNote: "caro" }), q({ status: "PAID" }), q({ expiredAt: hace(1) })],
      "C1"
    ),
    null
  );
  assert.equal(presupuestoDelHilo([q({ id: "s", lostReason: "NO_RESPONSE", lostReasonNote: "auto:sin_respuesta" })], "C1")?.id, "s", "cierre suave: aún pagable");
});

test("borrador sustituible: mismo cliente/par/expediente, sin enviar ni pedido, ≤2 h", () => {
  const base = { status: "DRAFT", createdAt: new Date(AHORA.getTime() - 3_600_000), customerEmail: "a@b.es", sourceLang: "es", targetLang: "it", expedienteRef: null, envios: 0, pedidos: 0 };
  const nuevo = { customerEmail: "a@b.es", sourceLang: "es", targetLang: "it", expedienteRef: null };
  assert.ok(esBorradorSustituible(base, nuevo, AHORA));
  assert.ok(!esBorradorSustituible({ ...base, envios: 1 }, nuevo, AHORA));
  assert.ok(!esBorradorSustituible({ ...base, status: "SENT" }, nuevo, AHORA));
  assert.ok(!esBorradorSustituible({ ...base, createdAt: new Date(AHORA.getTime() - 3 * 3_600_000) }, nuevo, AHORA));
  assert.ok(!esBorradorSustituible(base, { ...nuevo, targetLang: "en" }, AHORA));
});

test("coste desde la solicitud: la cifra del jurado es el coste, suma exacta", () => {
  assert.deepEqual(repartirCosteLead([{ coste: 150 }], 12000), [120]);
  assert.deepEqual(repartirCosteLead([{ coste: 30 }, { coste: 90 }], 12000), [30, 90]);
  assert.deepEqual(repartirCosteLead([{ coste: 0, palabras: 100 }, { coste: 50, palabras: 300 }], 10000), [25, 75]);
  const tres = repartirCosteLead([{}, {}, {}], 10000);
  assert.deepEqual(tres, [33.33, 33.33, 33.34]);
  assert.equal(Math.round(tres.reduce((a, x) => a + x, 0) * 100), 10000);
  assert.deepEqual(repartirCosteLead([], 10000), []);
  assert.deepEqual(repartirCosteLead([{ coste: 10 }], 0), []);
});

const sib = (o: Partial<OpenSibling>): OpenSibling => ({
  kind: "lead",
  ref: "x",
  id: "x",
  at: AHORA,
  chan: "puerta",
  par: "ES>IT",
  email: "m@x.es",
  phone: null,
  url: "/",
  via: "email",
  samePar: true,
  ...o,
});

test("banner: lo del mismo caso es el hilo, no un aviso (CASO-AX2MYY)", () => {
  const sesion = sib({ kind: "lead", id: "c2eccbe4-tok", ref: "puerta:c2eccbe4", casoId: null });
  const lead = sib({ kind: "lpr", id: "l1", ref: "LEAD-B49ADA6E30", casoId: "C1", expedienteRef: "puerta:c2eccbe4-tok" });
  const otro = sib({ kind: "quote", id: "q9", ref: "2026-00300", casoId: "C2" });
  const sinCaso = sib({ kind: "inbox", id: "i1", ref: "Hola", casoId: null });
  const r = separarPorCaso([sesion, lead, otro, sinCaso], "C1");
  assert.deepEqual(r.hilo.map((s) => s.id).sort(), ["c2eccbe4-tok", "l1"]);
  assert.deepEqual(r.otros.map((s) => s.id).sort(), ["i1", "q9"]);
});

test("banner: la sesión cuya solicitud es la propia (excluida) sigue siendo hilo por los flujos del caso", () => {
  const sesion = sib({ kind: "lead", id: "tok", ref: "puerta:tok", casoId: null });
  assert.deepEqual(separarPorCaso([sesion], "C1", ["puerta:tok"]).hilo.length, 1);
  assert.deepEqual(separarPorCaso([sesion], "C1").otros.length, 1);
  assert.deepEqual(separarPorCaso([sesion], null).otros.length, 1, "sin caso todo avisa como antes");
});
