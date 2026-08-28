import test from "node:test";
import assert from "node:assert/strict";
import { reconcile } from "../../lib/bank-reconcile.ts";

// Casos REALES de producción (28-ago-2026). El extracto trae el neto del payout
// y su fecha de llegada; ningún pedido suelto cuadra con esa línea.
const vacio = { invoices: [], orders: [], expenses: [], decisions: [] };
const txn = (bookingDate: string, amountCents: number, description: string) => ({
  bookingDate, amountCents, description, valueDate: bookingDate, balanceCents: null,
} as any);

test("liquidación AGRUPADA de 3 cobros: la línea del banco se explica entera", () => {
  // payout del 27-jul: 78,65 + 63,53 + 60,50 = 202,68 bruto − 5,96 = 195,71
  const r = reconcile([txn("2026-07-27", 19571, "LIQ.OP. STRIPE")], {
    ...vacio,
    payouts: [{
      id: "po_test1", arrivalDate: "2026-07-27T00:00:00.000Z",
      netCents: 19571, grossCents: 20268, feeCents: 596,
      orders: [
        { reference: "TJ-20260721-H0WN", amountCents: 7865, clientName: "André Miranda" },
        { reference: "26_92E51F", amountCents: 6353, clientName: "Emanuel guerra" },
        { reference: "TJ-20260718-XXXX", amountCents: 6050, clientName: null },
      ],
    }],
  } as any);
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].kind, "stripe_payout");
  assert.equal(r.matched[0].payout?.orders.length, 3);
  assert.ok(r.matched[0].flags.includes("agrupado"));
  assert.equal(r.totals.gapIn, 0, "no puede quedar hueco de ingreso");
});

test("liquidación de UN solo cobro: también se casa por el neto, no por el bruto", () => {
  // payout del 22-jun: cobro de 118,06 el día 12 → llegan 116,04 el día 22.
  // Diez días de diferencia: por eso fallaba contra el pedido.
  const r = reconcile([txn("2026-06-22", 11604, "LIQ.OP. STRIPE")], {
    ...vacio,
    payouts: [{
      id: "po_test2", arrivalDate: "2026-06-22T00:00:00.000Z",
      netCents: 11604, grossCents: 11806, feeCents: 202,
      orders: [{ reference: "TJ-20260612-9981", amountCents: 11806, clientName: "Valentina Gulpe" }],
    }],
  } as any);
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].kind, "stripe_payout");
  assert.equal(r.matched[0].flags.length, 0, "una sola no va marcada como agrupada");
});

test("una liquidación NO se usa dos veces", () => {
  const p = {
    id: "po_test3", arrivalDate: "2026-08-24T00:00:00.000Z",
    netCents: 17647, grossCents: 18083, feeCents: 346,
    orders: [{ reference: "A", amountCents: 6050, clientName: null }],
  };
  const r = reconcile(
    [txn("2026-08-24", 17647, "LIQ.OP. STRIPE"), txn("2026-08-24", 17647, "LIQ.OP. STRIPE")],
    { ...vacio, payouts: [p] } as any
  );
  assert.equal(r.matched.filter((m) => m.kind === "stripe_payout").length, 1);
  assert.equal(r.unmatchedIncome.length + r.ambiguous.length, 1, "la segunda queda sin casar");
});

test("un ingreso que no es liquidación sigue su camino normal", () => {
  const r = reconcile([txn("2026-08-24", 5000, "TRANSFERENCIA DE UN CLIENTE")], {
    ...vacio,
    payouts: [{ id: "po_x", arrivalDate: "2026-08-24T00:00:00.000Z", netCents: 17647, grossCents: 18083, feeCents: 346, orders: [] }],
  } as any);
  assert.equal(r.matched.length, 0);
});
