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

// ---- customerCreditBlocker: el mismo mensaje en presupuesto, pedido y endpoint ----
import { customerCreditBlocker, isSpainCountry } from "../../lib/credit-terms.ts";

test("customerCreditBlocker: sin ficha no hay crédito", () => {
  assert.match(customerCreditBlocker(null) || "", /No hay ficha/);
});

test("customerCreditBlocker: el permiso va primero (un clic en la ficha)", () => {
  const c = { name: "Brice Karsenty", creditEnabled: false, fiscalName: null, nif: null };
  assert.match(customerCreditBlocker(c) || "", /no está marcado como cliente de crédito/);
});

test("customerCreditBlocker: con permiso pero sin NIF, la factura saldría simplificada", () => {
  const c = { name: "Brice Karsenty", creditEnabled: true, fiscalName: "INVERSIONES KARSENTY SLU", nif: null };
  assert.match(customerCreditBlocker(c) || "", /razón social o NIF/);
  const c2 = { ...c, nif: "B12345678", fiscalName: "" };
  assert.match(customerCreditBlocker(c2) || "", /razón social o NIF/);
});

test("customerCreditBlocker: fuera de España se emite a mano (IVA no es el 21 % fijo)", () => {
  const c = { name: "X", creditEnabled: true, fiscalName: "X SARL", nif: "FR123", country: "Francia" };
  assert.match(customerCreditBlocker(c) || "", /Francia/);
});

test("customerCreditBlocker: cliente español completo → null (se puede autorizar)", () => {
  const c = { name: "Brice Karsenty", creditEnabled: true, fiscalName: "INVERSIONES KARSENTY SLU", nif: "B12345678", country: "España" };
  assert.equal(customerCreditBlocker(c), null);
  assert.equal(customerCreditBlocker({ ...c, country: null }), null, "sin país = España por defecto");
  assert.equal(customerCreditBlocker({ ...c, country: "spain" }), null);
});

test("isSpainCountry acepta las grafías que llegan de los formularios", () => {
  for (const v of ["España", "Espana", "ESPAÑA", "Spain", "es", "", null, undefined]) assert.equal(isSpainCountry(v), true, String(v));
  for (const v of ["Francia", "Portugal", "FR"]) assert.equal(isSpainCountry(v), false, v);
});

// ── Factura AGRUPADA del mes (4-sep-2026, Marbella Translators) ───────────────
import {
  isMonthlySecured,
  isMonthlyBilling,
  periodKeyOf,
  periodLabel,
  isPeriodClosed,
  monthlyInvoiceLines,
} from "../../lib/credit-terms.ts";

test("un borrador mensual asegura; anulado, presupuesto o nada, no", () => {
  assert.equal(isMonthlySecured({ status: "DRAFT", docKind: "invoice" }), true, "el borrador del mes ya asegura");
  assert.equal(isMonthlySecured({ status: "ISSUED", docKind: "invoice", dueDate: new Date() }), true);
  assert.equal(isMonthlySecured({ status: "ISSUED", docKind: "invoice", annulledAt: new Date() }), false, "anulada no");
  assert.equal(isMonthlySecured({ status: "DRAFT", docKind: "quote" }), false, "un presupuesto de la serie no");
  assert.equal(isMonthlySecured(null), false);
});

test("isOrderSecured acepta la factura del mes sin factura propia", () => {
  assert.equal(isOrderSecured({ paymentStatus: "PENDING", monthlyInvoice: { status: "DRAFT", docKind: "invoice" } }), true);
  assert.equal(isOrderSecured({ paymentStatus: "PENDING", clientInvoice: null, monthlyInvoice: null }), false);
  // La factura por pedido sigue mandando aunque no haya mensual.
  assert.equal(isOrderSecured({ paymentStatus: "PENDING", clientInvoice: fra() }), true);
});

test("el ciclo mensual exige crédito activado", () => {
  assert.equal(isMonthlyBilling({ creditEnabled: true, billingCycle: "MONTHLY" }), true);
  assert.equal(isMonthlyBilling({ creditEnabled: false, billingCycle: "MONTHLY" }), false, "sin permiso no hay carril");
  assert.equal(isMonthlyBilling({ creditEnabled: true, billingCycle: "PER_ORDER" }), false);
  assert.equal(isMonthlyBilling({ creditEnabled: true }), false, "por defecto, por pedido");
});

test("la clave del periodo es el mes de Madrid, no el UTC", () => {
  // 31-ago 23:30 en Madrid (UTC+2) = 21:30Z: sigue siendo agosto.
  assert.equal(periodKeyOf(new Date("2026-08-31T21:30:00Z")), "2026-08");
  // 30-sep 22:30Z = 1-oct 00:30 en Madrid: ya es octubre.
  assert.equal(periodKeyOf(new Date("2026-09-30T22:30:00Z")), "2026-10");
  assert.equal(periodLabel("2026-09"), "septiembre de 2026");
  assert.equal(periodLabel("garbage"), "");
  assert.equal(isPeriodClosed("2026-08", AHORA), true, "agosto en septiembre: a emitir");
  assert.equal(isPeriodClosed("2026-09", AHORA), false);
  assert.equal(isPeriodClosed(null, AHORA), false);
});

test("las líneas del mes van en base, una por pedido y en orden estable", () => {
  const lines = monthlyInvoiceLines([
    { reference: "26_B", title: "Acta", langPair: "fr-es", amountCents: 6655 },
    { reference: "26_A", title: "", langPair: null, amountCents: 12100 },
  ]);
  assert.deepEqual(lines, [
    { description: "26_A · Traducción jurada", detail: undefined, amountCents: 10000 },
    { description: "26_B · Acta", detail: "fr-es", amountCents: 5500 },
  ]);
});
