import test from "node:test";
import assert from "node:assert/strict";
import { orderClosure, supplierBlocksClosure, type ClosureInput } from "../../lib/order-closure.ts";

const AHORA = new Date("2026-09-19T12:00:00Z");
const h = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);

function base(p: Partial<ClosureInput> = {}): ClosureInput {
  return {
    deliveredToClientAt: h(48),
    correctedAt: null,
    hasCollaborator: true,
    supplierInvoiceStatus: "PAID",
    supplierBillingMode: "PER_ORDER",
    now: AHORA,
    ...p,
  };
}

test("cerrado: entregado hace 48 h, sin corrección y con el colaborador pagado", () => {
  const v = orderClosure(base());
  assert.equal(v.closed, true);
  assert.equal(v.pendiente, "");
});

test("no cerrado: el cliente aún no ha recibido nada", () => {
  const v = orderClosure(base({ deliveredToClientAt: null }));
  assert.equal(v.closed, false);
  assert.match(v.pendiente, /todavía no ha recibido/);
  assert.equal(v.cierraEl, null);
});

test("no cerrado: entregado hace 3 h — el margen de revisión no ha pasado", () => {
  const v = orderClosure(base({ deliveredToClientAt: h(3) }));
  assert.equal(v.closed, false);
  assert.match(v.pendiente, /faltan 21 h/);
  assert.deepEqual(v.cierraEl, new Date("2026-09-20T09:00:00Z"));
});

test("justo en el filo: a las 24 h exactas ya cierra", () => {
  const v = orderClosure(base({ deliveredToClientAt: h(24) }));
  assert.equal(v.closed, true);
});

test("una corrección reinicia el reloj desde la corrección", () => {
  const v = orderClosure(base({ deliveredToClientAt: h(72), correctedAt: h(2) }));
  assert.equal(v.closed, false);
  assert.match(v.pendiente, /corregida/);
  assert.match(v.pendiente, /faltan 22 h/);
});

test("una corrección ANTERIOR a la última entrega no reinicia nada", () => {
  const v = orderClosure(base({ deliveredToClientAt: h(30), correctedAt: h(50) }));
  assert.equal(v.closed, true);
});

test("no cerrado: pasó el margen pero la factura del colaborador sigue sin pagar", () => {
  const v = orderClosure(base({ supplierInvoiceStatus: "RECEIVED" }));
  assert.equal(v.closed, false);
  assert.match(v.pendiente, /factura del colaborador/);
});

test("el colaborador que factura a FIN DE MES no bloquea el cierre (regla de Juan)", () => {
  const v = orderClosure(base({ supplierInvoiceStatus: "EXPECTED", supplierBillingMode: "MONTHLY_BATCH" }));
  assert.equal(v.closed, true);
});

test("sin colaborador (francés, lo jura la casa) el proveedor no pinta nada", () => {
  const v = orderClosure(base({ hasCollaborator: false, supplierInvoiceStatus: "UNKNOWN" }));
  assert.equal(v.closed, true);
});

test("supplierBlocksClosure: solo bloquea el colaborador por pedido y sin pagar", () => {
  const con = { hasCollaborator: true, supplierBillingMode: "PER_ORDER" as const };
  assert.equal(supplierBlocksClosure({ ...con, supplierInvoiceStatus: "PAID" }), false);
  assert.equal(supplierBlocksClosure({ ...con, supplierInvoiceStatus: "BOOKED" }), true);
  assert.equal(supplierBlocksClosure({ ...con, supplierInvoiceStatus: "UNKNOWN" }), true);
  assert.equal(supplierBlocksClosure({ hasCollaborator: false, supplierBillingMode: "PER_ORDER", supplierInvoiceStatus: "UNKNOWN" }), false);
});

test("un pedido A CRÉDITO se cierra aunque el dinero llegue a 30 días (el cobro vive en Facturas)", () => {
  // 26_DCBAE3 (Andraca): entregado, factura 26_064 con vencimiento a 30 días.
  const v = orderClosure(base({ deliveredToClientAt: h(48), hasCollaborator: false }));
  assert.equal(v.closed, true);
});
