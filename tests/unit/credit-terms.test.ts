import test from "node:test";
import assert from "node:assert/strict";
import {
  isCreditAuthorized,
  isCreditOutstanding,
  isCreditOverdue,
  creditDaysToDue,
  isOrderSecured,
  customerCanUseCredit,
  defaultDueDate,
  fiscalQuarter,
  isWithinFiscalQuarter,
} from "../../lib/credit-terms.ts";

const AHORA = new Date("2026-09-02T10:00:00Z");
const fra = (o: Record<string, unknown> = {}) => ({
  status: "ISSUED",
  docKind: "invoice",
  dueDate: new Date("2026-10-02T00:00:00Z"),
  paidAt: null,
  ...o,
});

test("autoriza solo una factura ISSUED, docKind invoice y con vencimiento", () => {
  assert.equal(isCreditAuthorized(fra()), true);
  assert.equal(isCreditAuthorized(fra({ status: "DRAFT" })), false, "un borrador no autoriza");
  assert.equal(isCreditAuthorized(fra({ docKind: "quote" })), false, "un presupuesto de la serie no autoriza");
  assert.equal(isCreditAuthorized(fra({ dueDate: null })), false, "sin vencimiento no hay carril");
  assert.equal(isCreditAuthorized(null), false);
  assert.equal(isCreditAuthorized(undefined), false);
});

test("las 27 facturas ISSUED sin cobrar que ya existen quedan fuera por construcción", () => {
  // En producción hay 27 facturas emitidas y sin paidAt, ninguna con dueDate.
  // Si alguna colara, el cliente podría descargar sin haber pagado.
  const preexistente = fra({ dueDate: null, paidAt: null });
  assert.equal(isCreditAuthorized(preexistente), false);
  assert.equal(isOrderSecured({ paymentStatus: "PENDING", clientInvoice: preexistente }), false);
});

test("outstanding = autorizada y sin cobrar", () => {
  assert.equal(isCreditOutstanding(fra()), true);
  assert.equal(isCreditOutstanding(fra({ paidAt: new Date("2026-09-20T00:00:00Z") })), false);
  assert.equal(isCreditOutstanding(fra({ dueDate: null })), false);
});

test("sigue autorizada después de cobrada (el derecho existió)", () => {
  const cobrada = fra({ paidAt: new Date("2026-09-20T00:00:00Z") });
  assert.equal(isCreditAuthorized(cobrada), true);
  assert.equal(isCreditOutstanding(cobrada), false);
});

test("días a vencimiento en los dos signos", () => {
  assert.equal(creditDaysToDue(fra({ dueDate: new Date("2026-09-12T00:00:00Z") }), AHORA), 10);
  assert.equal(creditDaysToDue(fra({ dueDate: new Date("2026-09-02T23:00:00Z") }), AHORA), 0);
  assert.equal(creditDaysToDue(fra({ dueDate: new Date("2026-08-28T00:00:00Z") }), AHORA), -5);
  assert.equal(creditDaysToDue(fra({ dueDate: null }), AHORA), null);
});

test("vencida solo si además sigue sin cobrar", () => {
  const vencida = fra({ dueDate: new Date("2026-08-01T00:00:00Z") });
  assert.equal(isCreditOverdue(vencida, AHORA), true);
  assert.equal(isCreditOverdue({ ...vencida, paidAt: new Date("2026-08-05T00:00:00Z") }, AHORA), false);
  assert.equal(isCreditOverdue(fra(), AHORA), false, "aún no ha vencido");
});

test("asegurado: cobrado o autorizado a crédito, nada más", () => {
  assert.equal(isOrderSecured({ paymentStatus: "PAID" }), true);
  assert.equal(isOrderSecured({ paymentStatus: "PENDING", clientInvoice: fra() }), true);
  assert.equal(isOrderSecured({ paymentStatus: "PENDING", clientInvoice: null }), false);
  assert.equal(isOrderSecured({ paymentStatus: "FAILED", clientInvoice: fra({ status: "DRAFT" }) }), false);
});

test("el permiso es del cliente, y por defecto NO lo tiene", () => {
  assert.equal(customerCanUseCredit({ creditEnabled: true }), true);
  assert.equal(customerCanUseCredit({ creditEnabled: false }), false);
  assert.equal(customerCanUseCredit({}), false, "por defecto ningún cliente compra a crédito");
  assert.equal(customerCanUseCredit(null), false);
});

test("vencimiento por defecto según los días del cliente, acotado a 1..90", () => {
  const desde = new Date("2026-09-02T00:00:00Z");
  assert.equal(defaultDueDate({ creditDays: 30 }, desde).toISOString().slice(0, 10), "2026-10-02");
  assert.equal(defaultDueDate({ creditDays: 15 }, desde).toISOString().slice(0, 10), "2026-09-17");
  assert.equal(defaultDueDate({}, desde).toISOString().slice(0, 10), "2026-10-02", "30 por defecto");
  assert.equal(defaultDueDate({ creditDays: 999 }, desde).toISOString().slice(0, 10), "2026-12-01", "tope 90");
  assert.equal(defaultDueDate({ creditDays: 0 }, desde).toISOString().slice(0, 10), "2026-09-03", "mínimo 1");
});

test("trimestre fiscal", () => {
  assert.equal(fiscalQuarter(new Date("2026-01-15T00:00:00Z")), 1);
  assert.equal(fiscalQuarter(new Date("2026-06-30T00:00:00Z")), 2);
  assert.equal(fiscalQuarter(new Date("2026-07-01T00:00:00Z")), 3);
  assert.equal(fiscalQuarter(new Date("2026-12-31T00:00:00Z")), 4);
});

test("conciliación manual: mismo trimestre sí, cruzar trimestre no", () => {
  // Orden de Juan: poder conciliar a mano mientras estemos en el mismo trimestre.
  const emitida = new Date("2026-07-16T00:00:00Z"); // 3T
  assert.equal(isWithinFiscalQuarter(emitida, new Date("2026-09-30T00:00:00Z")), true, "3T con 3T");
  assert.equal(isWithinFiscalQuarter(emitida, new Date("2026-07-16T00:00:00Z")), true, "mismo día");
  assert.equal(isWithinFiscalQuarter(emitida, new Date("2026-10-01T00:00:00Z")), false, "salta al 4T");
  assert.equal(isWithinFiscalQuarter(emitida, new Date("2026-06-30T00:00:00Z")), false, "hacia atrás, 2T");
  assert.equal(isWithinFiscalQuarter(emitida, new Date("2027-08-01T00:00:00Z")), false, "otro año");
  assert.equal(isWithinFiscalQuarter(null, new Date()), false);
});

test("un cobro a 30 días nunca entra en la ventana de 7 días de la conciliación automática", () => {
  // Es el motivo por el que se concilia a mano: bank-reconcile usa WINDOW_INCOME = 7 días.
  const emitida = new Date("2026-09-02T00:00:00Z");
  const cobro = new Date("2026-10-02T00:00:00Z");
  const dias = Math.round((+cobro - +emitida) / 86_400_000);
  assert.ok(dias > 7, "30 días caen fuera de la ventana automática");
  assert.equal(isWithinFiscalQuarter(emitida, cobro), false, "y además cruzan de trimestre: hay que avisar");
});
