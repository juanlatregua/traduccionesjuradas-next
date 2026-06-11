import test from "node:test";
import assert from "node:assert/strict";
import { toCents, parseDateFlexible, splitCsvLine, mapColumns } from "../../lib/csv.ts";
import { reconcile, computeLineHash, TOLERANCE_CENTS, type AccountingSnapshot } from "../../lib/bank-reconcile.ts";

// ── lib/csv ────────────────────────────────────────────────
test("toCents: formatos español/estándar y signo", () => {
  assert.equal(toCents("1.234,56"), 123456);
  assert.equal(toCents("12,00 €"), 1200);
  assert.equal(toCents("-12,34"), -1234);
  assert.equal(toCents("200"), 20000);
  assert.equal(toCents("200.50"), 20050); // punto decimal sin coma
  assert.equal(toCents(""), 0);
});

test("parseDateFlexible: DD/MM/YYYY, ISO, DD.MM.YY", () => {
  assert.equal(parseDateFlexible("15/03/2026")?.toISOString().slice(0, 10), "2026-03-15");
  assert.equal(parseDateFlexible("2026-03-15")?.toISOString().slice(0, 10), "2026-03-15");
  assert.equal(parseDateFlexible("02-03-2026")?.toISOString().slice(0, 10), "2026-03-02");
  assert.equal(parseDateFlexible("05.01.26")?.toISOString().slice(0, 10), "2026-01-05");
  assert.equal(parseDateFlexible("no es fecha"), null);
});

test("splitCsvLine respeta comillas con el separador dentro", () => {
  assert.deepEqual(splitCsvLine('15/03/2026;"PAGO, S.L.";200,00', ";"), ["15/03/2026", "PAGO, S.L.", "200,00"]);
});

test("mapColumns mapea por diccionario normalizado", () => {
  const idx = mapColumns(["Fecha", "Concepto", "Importe (€)"], { date: ["fecha"], description: ["concepto"], amount: ["importe (€)"] });
  assert.deepEqual(idx, { date: 0, description: 1, amount: 2 });
});

// ── motor ──────────────────────────────────────────────────
test("computeLineHash es determinista y distingue", () => {
  const a = computeLineHash({ bookingDate: "2026-05-10T00:00:00.000Z", amountCents: 24200, description: "Pago Oracle" });
  const b = computeLineHash({ bookingDate: "2026-05-10T23:59:00.000Z", amountCents: 24200, description: "pago oracle" });
  const c = computeLineHash({ bookingDate: "2026-05-10T00:00:00.000Z", amountCents: 24201, description: "Pago Oracle" });
  assert.equal(a, b); // mismo día + importe + concepto normalizado
  assert.notEqual(a, c);
});

function emptySnap(): AccountingSnapshot {
  return { invoices: [], orders: [], expenses: [], decisions: [] };
}

test("ingreso casa con factura emitida", () => {
  const snap = emptySnap();
  snap.invoices.push({ id: "i1", number: "26_010", totalCents: 24200, issuedAt: "2026-05-10T00:00:00.000Z", fiscalName: "Oracle", nif: "B1", paidAt: null });
  const r = reconcile([{ bookingDate: "2026-05-11T00:00:00.000Z", description: "Transf Oracle", amountCents: 24200 }], snap);
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].kind, "invoice");
  assert.equal(r.totals.matchedIn, 24200);
});

test("ingreso de pedido cobrado sin factura → cobro sin factura (alimenta #2)", () => {
  const snap = emptySnap();
  snap.orders.push({ reference: "TJ-1", amountCents: 6050, paidAt: "2026-05-10T00:00:00.000Z", createdAt: "2026-05-10T00:00:00.000Z", clientName: "Maite", paymentStatus: "PAID" });
  const r = reconcile([{ bookingDate: "2026-05-11T00:00:00.000Z", description: "Pago tarjeta", amountCents: 6050 }], snap);
  assert.equal(r.incomeNoInvoice.length, 1);
  assert.equal(r.incomeNoInvoice[0].candidateOrder?.reference, "TJ-1");
});

test("neto de comisión de pasarela se marca netOfFee, no exige gasto", () => {
  const snap = emptySnap();
  snap.orders.push({ reference: "TJ-2", amountCents: 10000, paidAt: "2026-05-10T00:00:00.000Z", createdAt: "2026-05-10T00:00:00.000Z", clientName: null, paymentStatus: "PAID" });
  // 9650 = 10000 − 3,5% comisión (>tolerancia 300, dentro de 4%)
  const r = reconcile([{ bookingDate: "2026-05-10T00:00:00.000Z", description: "Liquidacion Stripe", amountCents: 9650 }], snap);
  assert.equal(r.incomeNoInvoice.length, 1);
  assert.ok(r.incomeNoInvoice[0].flags.includes("netOfFee"));
  assert.equal(r.chargeNoExpense.length, 0);
});

test(">1 candidato de factura → ambiguo, no auto-confirma", () => {
  const snap = emptySnap();
  snap.invoices.push({ id: "i1", number: "26_001", totalCents: 10000, issuedAt: "2026-05-10T00:00:00.000Z", fiscalName: "A", nif: null, paidAt: null });
  snap.invoices.push({ id: "i2", number: "26_002", totalCents: 10000, issuedAt: "2026-05-11T00:00:00.000Z", fiscalName: "B", nif: null, paidAt: null });
  const r = reconcile([{ bookingDate: "2026-05-10T00:00:00.000Z", description: "Ingreso", amountCents: 10000 }], snap);
  assert.equal(r.ambiguous.length, 1);
  assert.equal(r.ambiguous[0].candidates.length, 2);
  assert.equal(r.matched.length, 0);
});

test("cargo casa con gasto; sin gasto → cargo sin gasto", () => {
  const snap = emptySnap();
  snap.expenses.push({ id: "e1", totalCents: 5000, date: "2026-05-10T00:00:00.000Z", supplier: "Proveedor", concept: "Software", paidAt: null });
  const r = reconcile(
    [
      { bookingDate: "2026-05-12T00:00:00.000Z", description: "Recibo Proveedor", amountCents: -5000 },
      { bookingDate: "2026-05-12T00:00:00.000Z", description: "Compra X", amountCents: -9999 },
    ],
    snap
  );
  assert.equal(r.matched.filter((m) => m.kind === "expense").length, 1);
  assert.equal(r.chargeNoExpense.length, 1);
});

test("traspaso interno → sección interna, no exige gasto", () => {
  const r = reconcile([{ bookingDate: "2026-05-10T00:00:00.000Z", description: "Traspaso a cuenta propia", amountCents: -100000 }], emptySnap());
  assert.equal(r.internal.length, 1);
  assert.equal(r.chargeNoExpense.length, 0);
});

test("decisiones persistidas: IGNORED y MATCHED_MANUAL", () => {
  const snap = emptySnap();
  const txnIgnore = { bookingDate: "2026-05-10T00:00:00.000Z", description: "Comision mantenimiento", amountCents: -300 };
  const txnManual = { bookingDate: "2026-05-11T00:00:00.000Z", description: "Cobro raro", amountCents: 5000 };
  snap.decisions.push({ lineHash: computeLineHash(txnIgnore), status: "IGNORED", matchedType: null, matchedId: null, note: "comisión banco" });
  snap.decisions.push({ lineHash: computeLineHash(txnManual), status: "MATCHED_MANUAL", matchedType: "invoice", matchedId: "i9", note: null });
  const r = reconcile([txnIgnore, txnManual], snap);
  assert.equal(r.ignored.length, 1);
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].flags.includes("manual"), true);
});

test("consumo greedy: dos ingresos iguales no roban la misma factura", () => {
  const snap = emptySnap();
  snap.invoices.push({ id: "i1", number: "26_005", totalCents: 10000, issuedAt: "2026-05-10T00:00:00.000Z", fiscalName: "A", nif: null, paidAt: null });
  const r = reconcile(
    [
      { bookingDate: "2026-05-10T00:00:00.000Z", description: "Ingreso 1", amountCents: 10000 },
      { bookingDate: "2026-05-10T00:00:00.000Z", description: "Ingreso 2", amountCents: 10000 },
    ],
    snap
  );
  assert.equal(r.matched.length, 1); // solo uno consume la factura
  assert.equal(r.unmatchedIncome.length, 1); // el otro queda sin identificar
});

test("checksum de saldo detecta huecos", () => {
  const cont = reconcile(
    [
      { bookingDate: "2026-05-10T00:00:00.000Z", description: "a", amountCents: 1000, balanceCents: 11000 },
      { bookingDate: "2026-05-11T00:00:00.000Z", description: "b", amountCents: -500, balanceCents: 10500 },
    ],
    emptySnap()
  );
  assert.equal(cont.balanceCheck.ok, true);
  const broken = reconcile(
    [
      { bookingDate: "2026-05-10T00:00:00.000Z", description: "a", amountCents: 1000, balanceCents: 11000 },
      { bookingDate: "2026-05-11T00:00:00.000Z", description: "b", amountCents: -500, balanceCents: 9000 },
    ],
    emptySnap()
  );
  assert.equal(broken.balanceCheck.ok, false);
});

test("checksum de saldo acepta extracto en orden descendente (nuevo→antiguo)", () => {
  const r = reconcile(
    [
      { bookingDate: "2026-05-11T00:00:00.000Z", description: "b", amountCents: -500, balanceCents: 10500 },
      { bookingDate: "2026-05-10T00:00:00.000Z", description: "a", amountCents: 1000, balanceCents: 11000 },
    ],
    emptySnap()
  );
  assert.equal(r.balanceCheck.ok, true);
});

test("dos pedidos igual de buenos → ambiguo (no auto-elige)", () => {
  const snap = emptySnap();
  snap.orders.push({ reference: "TJ-A", amountCents: 5000, paidAt: "2026-05-10T00:00:00.000Z", createdAt: "2026-05-10T00:00:00.000Z", clientName: "A", paymentStatus: "PAID" });
  snap.orders.push({ reference: "TJ-B", amountCents: 5000, paidAt: "2026-05-10T00:00:00.000Z", createdAt: "2026-05-10T00:00:00.000Z", clientName: "B", paymentStatus: "PAID" });
  const r = reconcile([{ bookingDate: "2026-05-10T00:00:00.000Z", description: "Ingreso", amountCents: 5000 }], snap);
  assert.equal(r.ambiguous.length, 1);
  assert.equal(r.incomeNoInvoice.length, 0);
});

test("MATCHED_MANUAL consume el objetivo (no se auto-empareja otra vez)", () => {
  const snap = emptySnap();
  snap.invoices.push({ id: "i1", number: "26_001", totalCents: 10000, issuedAt: "2026-05-10T00:00:00.000Z", fiscalName: "A", nif: null, paidAt: null });
  const txnManual = { bookingDate: "2026-05-09T00:00:00.000Z", description: "Cobro raro", amountCents: 9999 };
  snap.decisions.push({ lineHash: computeLineHash(txnManual), status: "MATCHED_MANUAL", matchedType: "invoice", matchedId: "i1", note: null });
  const r = reconcile([txnManual, { bookingDate: "2026-05-10T00:00:00.000Z", description: "Ingreso", amountCents: 10000 }], snap);
  assert.equal(r.matched.length, 1); // solo el manual
  assert.equal(r.unmatchedIncome.length, 1); // el real no roba la factura ya consumida
});

test("líneas idénticas reciben lineHash distinto (decisión no se aplica a todas)", () => {
  const r = reconcile(
    [
      { bookingDate: "2026-05-10T00:00:00.000Z", description: "Comision", amountCents: -300 },
      { bookingDate: "2026-05-10T00:00:00.000Z", description: "Comision", amountCents: -300 },
    ],
    emptySnap()
  );
  const hashes = r.chargeNoExpense.map((x: any) => x.lineHash);
  assert.equal(hashes.length, 2);
  assert.notEqual(hashes[0], hashes[1]);
});

test("TOLERANCE_CENTS dentro de rango", () => {
  assert.ok(TOLERANCE_CENTS >= 100 && TOLERANCE_CENTS <= 500);
});
