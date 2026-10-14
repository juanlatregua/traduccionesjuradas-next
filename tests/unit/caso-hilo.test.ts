import test from "node:test";
import assert from "node:assert/strict";
import { decidirSolicitud, quotesACongelar, reservaViva, RESERVA_MIN, retirarEnOrden, vivasDelPar, presupuestoDelHilo, esBorradorSustituible, type LprDelHilo, type QuoteDelHilo } from "../../lib/caso/hilo.ts";
import { aplicarCosteJurado, type LineaCoste } from "../../lib/caso/coste-lead.ts";
import { salidaPorPresupuestoNuevo } from "../../lib/precio-tras-envio-math.ts";
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
  assert.deepEqual(d.congelar, []);
  assert.deepEqual(decidirSolicitud({ lprs: [], par: "ES>IT", ahora: AHORA, volverAPedir: true }), { accion: "crear" });
});

test("volver a pedir: nunca retira ACCEPTED ni una atada a presupuesto formalizado", () => {
  const a = decidirSolicitud({ lprs: [lpr({ ref: "A", status: "ACCEPTED" }), lpr({ ref: "B" })], par: "ES>IT", ahora: AHORA, volverAPedir: true });
  assert.equal(a.accion, "bloquear");
  assert.equal(a.accion === "bloquear" && a.viva.ref, "A");
  for (const quoteStatus of ["PAID", "IN_PROGRESS", "DELIVERED"]) {
    const d = decidirSolicitud({ lprs: [lpr({ ref: "P", status: "PRICED", priceCents: 9000, quoteId: "q", quoteStatus })], par: "ES>IT", ahora: AHORA, volverAPedir: true });
    assert.equal(d.accion, "bloquear", quoteStatus);
  }
  assert.equal(decidirSolicitud({ lprs: [lpr({ status: "ACCEPTED" })], par: "ES>IT", ahora: AHORA }).accion, "reutilizar", "sin volver a pedir, se reutiliza");
});

test("volver a pedir: retirar una cifra con presupuesto enviado pide congelar ese presupuesto", () => {
  const d = decidirSolicitud({
    lprs: [lpr({ ref: "P", status: "PRICED", priceCents: 12000, quoteId: "q1", quoteStatus: "SENT" }), lpr({ ref: "S", quoteId: "q2", quoteStatus: "DRAFT" })],
    par: "ES>IT",
    ahora: AHORA,
    volverAPedir: true,
  });
  assert.equal(d.accion, "reemplazar");
  assert.deepEqual(d.accion === "reemplazar" && d.congelar, ["q1"]);
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
  sourceLang: "es",
  targetLang: "it",
  ...o,
});

test("presupuesto del hilo: la vigente primero; borrado, perdido a mano, pagado o caducado no", () => {
  assert.equal(presupuestoDelHilo([q({ id: "a" }), q({ id: "b", liveCasoKey: "C1", createdAt: hace(5) })], "C1", "ES>IT")?.id, "b");
  assert.equal(presupuestoDelHilo([q({ id: "a", createdAt: hace(3) }), q({ id: "b", createdAt: hace(1) })], "C1", "ES>IT")?.id, "b");
  assert.equal(
    presupuestoDelHilo(
      [q({ deletedAt: hace(1) }), q({ lostReason: "PRICE", lostReasonNote: "caro" }), q({ status: "PAID" }), q({ expiredAt: hace(1) })],
      "C1",
      "ES>IT"
    ),
    null
  );
  assert.equal(presupuestoDelHilo([q({ id: "s", lostReason: "NO_RESPONSE", lostReasonNote: "auto:sin_respuesta" })], "C1", "ES>IT")?.id, "s", "cierre suave: aún pagable");
});

test("multi-par: IT>ES presupuestado no impide presupuestar EN>ES del mismo caso", () => {
  const it = q({ id: "it", sourceLang: "it", targetLang: "es", liveCasoKey: "C1" });
  assert.equal(presupuestoDelHilo([it], "C1", "IT>ES")?.id, "it");
  assert.equal(presupuestoDelHilo([it], "C1", "EN>ES"), null);
  assert.equal(presupuestoDelHilo([it], "C1", null), null, "par desconocido: no se adivina");
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

const linea = (o: Partial<LineaCoste>): LineaCoste => ({ id: "l", url: "u1", costeCents: 0, ventaCents: 0, porPagina: false, ...o });

test("coste del jurado: es el coste y la venta del motor se conserva si el margen da", () => {
  const r = aplicarCosteJurado([linea({ costeCents: 15000, ventaCents: 30000 })], { baseCents: 12000, docsCount: 1 });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.lineas[0].costeCents, 12000, "120 del jurado, no los 150 del análisis");
  assert.equal(r.lineas[0].ventaCents, 30000, "venta del motor intacta");
});

test("coste del jurado: la venta solo sube si con la del motor no hay margen", () => {
  const r = aplicarCosteJurado([linea({ costeCents: 3000, ventaCents: 4000 })], { baseCents: 9000, docsCount: 1 });
  assert.ok(r.ok && r.lineas[0].ventaCents > 9000);
});

test("coste del jurado: solo a los documentos de la solicitud; extras manuales intactos; reparto exacto", () => {
  const r = aplicarCosteJurado(
    [linea({ id: "a", url: "u1", costeCents: 3000, ventaCents: 6000 }), linea({ id: "b", url: "u1", costeCents: 9000, ventaCents: 15000 }), linea({ id: "m", url: null, costeCents: 500, ventaCents: 1000 })],
    { baseCents: 10000, docsCount: 1 }
  );
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.lineas.map((l) => l.id), ["a", "b"]);
  assert.equal(r.lineas.reduce((a, l) => a + l.costeCents, 0), 10000);
  assert.deepEqual(r.lineas.map((l) => l.costeCents), [2500, 7500]);
});

test("coste del jurado: si los documentos no cuadran no reparte y avisa", () => {
  const r = aplicarCosteJurado([linea({ id: "a", url: "u1" }), linea({ id: "b", url: "u2" })], { baseCents: 10000, docsCount: 3 });
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.motivo : "", /cubre 3 docs/);
  assert.ok(aplicarCosteJurado([linea({ url: null })], { baseCents: 5000, docsCount: 2 }).ok, "lead sin documentos: la única línea manual");
  assert.equal(aplicarCosteJurado([linea({ url: null }), linea({ id: "x", url: null })], { baseCents: 5000, docsCount: 2 }).ok, false);
});

test("coste del jurado: tarifa por página conserva la venta publicada", () => {
  const r = aplicarCosteJurado([linea({ costeCents: 1000, ventaCents: 3000, porPagina: true })], { baseCents: 2500, docsCount: 1 });
  assert.ok(r.ok && r.lineas[0].ventaCents === 3000);
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

test("retirada a medias: para en el primer fallo y devuelve lo ya retirado (para el rastro)", async () => {
  const llamadas: string[] = [];
  const r = await retirarEnOrden([{ ref: "A" }, { ref: "B" }, { ref: "C" }], async (l) => {
    llamadas.push(l.ref);
    return l.ref === "B" ? { ok: false, status: 409, error: "ya lo tiene Morton" } : { ok: true };
  });
  assert.deepEqual(r.retiradas, ["A"]);
  assert.deepEqual(r.fallo, { ref: "B", status: 409, error: "ya lo tiene Morton" });
  assert.deepEqual(llamadas, ["A", "B"], "C no se toca");
  assert.deepEqual(await retirarEnOrden([{ ref: "A" }], async () => ({ ok: true })), { retiradas: ["A"], fallo: null });
});

test("reserva del hilo: viva → otra petición recibe 409 «envío en curso»; caducada o sin fecha → libre", () => {
  const exp = (min: number) => ({ expiresAt: new Date(AHORA.getTime() + min * 60_000).toISOString() });
  assert.ok(reservaViva(exp(RESERVA_MIN), AHORA));
  assert.ok(!reservaViva(exp(-1), AHORA));
  assert.ok(!reservaViva(null, AHORA));
  assert.ok(!reservaViva({ expiresAt: "basura" }, AHORA));
});

test("volver a pedir: solo un envío correcto congela el presupuesto enviado", () => {
  assert.deepEqual(quotesACongelar(true, ["q1"]), ["q1"]);
  assert.deepEqual(quotesACongelar(false, ["q1"]), []);
});

test("presupuesto más reciente: el congelado por «volver a pedir» se descongela si no hay pérdida", () => {
  assert.equal(salidaPorPresupuestoNuevo("volver:LEAD-A", true, "ok"), "descongelar");
  assert.equal(salidaPorPresupuestoNuevo("volver:LEAD-A", true, "margen_bajo"), "descongelar");
  assert.equal(salidaPorPresupuestoNuevo("volver:LEAD-A", true, "perdida"), "salir");
  assert.equal(salidaPorPresupuestoNuevo("LEAD-A|9000|m1", true, "ok"), "salir", "congelado por pérdida: no se toca");
  assert.equal(salidaPorPresupuestoNuevo("volver:LEAD-A", false, "ok"), "salir");
});

test("coste del jurado: margen ≤0 visible", () => {
  const r = aplicarCosteJurado([linea({ costeCents: 1000, ventaCents: 3000, porPagina: true })], { baseCents: 3500, docsCount: 1 });
  assert.ok(r.ok && r.margenCents <= 0);
});
