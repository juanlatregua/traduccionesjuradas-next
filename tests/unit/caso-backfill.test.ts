import test from "node:test";
import assert from "node:assert/strict";
import { planBackfill, type BQuote, type BOrder, type BLpr, type BackfillInput } from "../../lib/caso/backfill-plan.ts";

const AHORA = new Date("2026-10-11T12:00:00Z");
const dia = (d: number) => new Date(AHORA.getTime() - d * 864e5);

let seq = 0;
const quote = (o: Partial<BQuote>): BQuote => {
  seq += 1;
  return {
    id: `q${seq}`, quoteNumber: `2026-${String(seq).padStart(5, "0")}`, status: "EXPIRED", deletedAt: null, customerId: "cu1",
    customerEmail: "ana@x.com", customerPhone: null, customerName: "Ana", sourceLang: "en", targetLang: "es", expedienteRef: null,
    holderNames: null, createdAt: dia(10), paidAt: null, balanceAmount: null, balancePaidAt: null, lostReason: null, lostReasonNote: null,
    fileKeys: [], casoId: null, liveCasoKey: null, supersededAt: null, ...o,
  };
};
const order = (o: Partial<BOrder>): BOrder => ({
  id: "o1", reference: "26_AAAA", quoteId: null, clientEmail: "ana@x.com", clientPhone: null, clientName: "Ana", langPair: "en->es",
  createdAt: dia(1), casoId: null, status: "PAID", paymentStatus: "PAID", deliveryState: "PRESUPUESTO", workflowState: "PAGO_VALIDADO", ...o,
});
const lpr = (o: Partial<BLpr>): BLpr => ({
  id: "l1", ref: "LEAD-1", par: "EN>ES", expedienteRef: null, customerHint: null, quoteId: null, status: "PRICED", contentKey: null,
  createdAt: dia(5), casoId: null, ...o,
});
const input = (o: Partial<BackfillInput>): BackfillInput => ({ ahora: AHORA, quotes: [], lprs: [], orders: [], sesiones: [], inbound: [], casos: [], customers: [], ...o });

test("versiones: mismo expediente ≤21 d → un caso; vigente = la del pedido; la vieja se marca sustituida", () => {
  const v1 = quote({ expedienteRef: "EXP-1", createdAt: dia(10), status: "EXPIRED" });
  const v2 = quote({ expedienteRef: "EXP-1", createdAt: dia(5), status: "PAID", paidAt: dia(2) });
  const p = planBackfill(input({ quotes: [v1, v2], orders: [order({ quoteId: v2.id })] }));
  assert.equal(p.casos.length, 1);
  const c = p.casos[0];
  assert.equal(c.estado, "EN_CURSO");
  assert.equal(c.vigenteId, v2.id);
  assert.deepEqual(c.quoteIds.sort(), [v1.id, v2.id].sort());
  assert.equal(p.sustituciones.length, 1);
  assert.equal(p.sustituciones[0].quoteId, v1.id);
  assert.equal(p.sustituciones[0].notaSustituido, true, "EXPIRED sustituida por una pagada → auto:sustituido");
  assert.ok(p.sustituciones[0].supersededAt);
});

test("la vigente de un caso con pedido es la del pedido aunque haya otra posterior", () => {
  const pagada = quote({ expedienteRef: "EXP-2", createdAt: dia(10), status: "SENT" });
  const borrador = quote({ expedienteRef: "EXP-2", createdAt: dia(8), status: "DRAFT" });
  // crédito: pedido sin pagar sobre el primero; el caso está EN_CURSO por existir el pedido
  const p = planBackfill(input({ quotes: [pagada, borrador], orders: [order({ quoteId: pagada.id, status: "PENDING_PAYMENT", paymentStatus: "PENDING" })] }));
  const c = p.casos.find((x) => x.quoteIds.includes(pagada.id))!;
  assert.equal(c.vigenteId, pagada.id);
  assert.equal(c.estado, "EN_CURSO");
});

test("nunca se toca una formalizada al sustituir: ni status ni supersededAt", () => {
  const pagada = quote({ createdAt: dia(10), status: "PAID", paidAt: dia(9), casoId: "C1" });
  const credito = quote({ createdAt: dia(3), status: "SENT", casoId: "C1" });
  const p = planBackfill(input({ quotes: [pagada, credito], orders: [order({ id: "o9", quoteId: credito.id, status: "PENDING_PAYMENT", paymentStatus: "PENDING" })], casos: [{ id: "C1", estado: "ABIERTO" }] }));
  const c = p.casos.find((x) => x.id === "C1")!;
  assert.equal(c.vigenteId, credito.id, "la del pedido");
  assert.equal(c.estado, "EN_CURSO");
  assert.equal(p.sustituciones.find((x) => x.quoteId === pagada.id), undefined);
  assert.equal(p.conflictosVigente.length, 1);
});

test("documento distinto, mismo cliente y par → caso nuevo con posible (no se une)", () => {
  const a = quote({ expedienteRef: "EXP-A", createdAt: dia(10) });
  const b = quote({ expedienteRef: "EXP-B", createdAt: dia(9) });
  const p = planBackfill(input({ quotes: [a, b] }));
  assert.equal(p.casos.length, 2);
  const cb = p.casos.find((c) => c.quoteIds.includes(b.id))!;
  assert.equal(cb.posibles.length, 1);
  assert.equal(cb.dudoso, false);
});

test("sin documentos: se une por identidad a un único caso; con dos abiertos → dudoso propio", () => {
  const a = quote({ expedienteRef: "EXP-A", createdAt: dia(10) });
  const manual = quote({ createdAt: dia(8) });
  const p = planBackfill(input({ quotes: [a, manual] }));
  assert.equal(p.casos.length, 1);

  const x = quote({ expedienteRef: "EXP-X", createdAt: dia(10) });
  const y = quote({ expedienteRef: "EXP-Y", createdAt: dia(9) });
  const z = quote({ createdAt: dia(8) });
  const p2 = planBackfill(input({ quotes: [x, y, z] }));
  assert.equal(p2.casos.length, 3);
  const cz = p2.casos.find((c) => c.quoteIds.includes(z.id))!;
  assert.equal(cz.dudoso, true);
  assert.equal(cz.posibles.length, 2);
});

test("caso con pedido no recibe versiones nuevas; borradas sin clave", () => {
  const pag = quote({ expedienteRef: "EXP-P", createdAt: dia(10), status: "PAID", paidAt: dia(9) });
  const despues = quote({ expedienteRef: "EXP-P", createdAt: dia(5), status: "SENT" });
  const borrada = quote({ expedienteRef: "EXP-Q", createdAt: dia(4), status: "DRAFT", deletedAt: dia(3), customerEmail: "otro@z.com" });
  const p = planBackfill(input({ quotes: [pag, despues, borrada], orders: [order({ quoteId: pag.id })] }));
  assert.equal(p.casos.length, 3);
  const cb = p.casos.find((c) => c.quoteIds.includes(borrada.id))!;
  assert.equal(cb.vigenteId, null);
  assert.equal(cb.estado, "PERDIDO");
});

test("solicitud que solo casa por identidad → caso propio dudoso; por presupuesto o huella → mismo caso", () => {
  const q = quote({ expedienteRef: "EXP-L", createdAt: dia(6), status: "SENT" });
  const atada = lpr({ id: "l1", ref: "LEAD-1", quoteId: q.id, contentKey: "k1" });
  const gemela = lpr({ id: "l2", ref: "LEAD-2", contentKey: "k1", createdAt: dia(4) });
  const suelta = lpr({ id: "l3", ref: "LEAD-3", customerHint: "Ana · ana@x.com", createdAt: dia(4) });
  const p = planBackfill(input({ quotes: [q], lprs: [atada, gemela, suelta] }));
  const cq = p.casos.find((c) => c.quoteIds.includes(q.id))!;
  assert.deepEqual(cq.lprIds.sort(), ["l1", "l2"]);
  assert.equal(cq.estado, "ABIERTO");
  const cs = p.casos.find((c) => c.lprIds.includes("l3"))!;
  assert.equal(cs.dudoso, true);
  assert.deepEqual(cs.posibles, [cq.id]);
});

test("sesión suelta = lead sin caso; sesión del expediente → caso", () => {
  const q = quote({ expedienteRef: "EXP-S", createdAt: dia(6), status: "SENT" });
  const p = planBackfill(
    input({
      quotes: [q],
      sesiones: [
        { token: "exp:EXP-S", analysisIds: ["a1"], orderIds: [], orderRefs: [], casoIds: [], createdAt: dia(6) },
        { token: "tok-lead", analysisIds: ["a2"], orderIds: [], orderRefs: [], casoIds: [], createdAt: dia(6) },
      ],
    })
  );
  assert.deepEqual(p.casos[0].analysisIds, ["a1"]);
  assert.deepEqual(p.sinCaso.map((s) => s.id), ["tok-lead"]);
});

test("idempotente: segunda pasada sobre lo ya asignado no planifica nada", () => {
  const q = quote({ expedienteRef: "EXP-I", status: "SENT", casoId: "C9", liveCasoKey: "C9" });
  const p = planBackfill(input({ quotes: [q], casos: [{ id: "C9", estado: "ABIERTO" }] }));
  assert.equal(p.casos.length, 0);
  assert.equal(p.sustituciones.length, 0);
});

test("lo nuevo se ata al caso existente por su presupuesto", () => {
  const q = quote({ expedienteRef: "EXP-N", status: "SENT", casoId: "C7", liveCasoKey: "C7" });
  const p = planBackfill(input({ quotes: [q], lprs: [lpr({ quoteId: q.id })], casos: [{ id: "C7", estado: "ABIERTO" }] }));
  assert.equal(p.casos.length, 1);
  assert.equal(p.casos[0].id, "C7");
  assert.deepEqual(p.casos[0].lprIds, ["l1"]);
  assert.equal(p.casos[0].vigenteId, null, "ya tenía vigente");
});

test("agencia (2 titulares): presupuesto sin documentos no se une, queda dudoso", () => {
  const a = quote({ customerEmail: "nuria@nf.es", holderNames: "Pérez", expedienteRef: "EXP-1A", createdAt: dia(10) });
  const b = quote({ customerEmail: "nuria@nf.es", holderNames: "López", createdAt: dia(9) });
  const p = planBackfill(input({ quotes: [a, b] }));
  assert.equal(p.casos.length, 2);
  assert.ok(p.casos.every((c) => c.esAgencia));
  assert.equal(p.casos.find((c) => c.quoteIds.includes(b.id))!.dudoso, true);
});
