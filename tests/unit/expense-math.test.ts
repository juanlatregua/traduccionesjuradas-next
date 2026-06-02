import test from "node:test";
import assert from "node:assert/strict";
import { clampIrpfPct, computeExpenseTotals } from "../../lib/expense-math.ts";

test("clampIrpfPct: whitelist 0 / 7% / 15% (sin 19%)", () => {
  assert.equal(clampIrpfPct(0.15), 0.15);
  assert.equal(clampIrpfPct(15), 0.15);
  assert.equal(clampIrpfPct(0.07), 0.07);
  assert.equal(clampIrpfPct(7), 0.07);
  assert.equal(clampIrpfPct(0.19), 0); // arrendamiento (115), fuera del 111
  assert.equal(clampIrpfPct(0), 0);
  assert.equal(clampIrpfPct(null), 0);
  assert.equal(clampIrpfPct("abc"), 0);
});

test("computeExpenseTotals: total = base+IVA; payable = base+IVA−IRPF", () => {
  const t = computeExpenseTotals(10000, 0.21, 0.15);
  assert.equal(t.baseCents, 10000);
  assert.equal(t.vatCents, 2100);
  assert.equal(t.irpfCents, 1500);
  assert.equal(t.totalCents, 12100); // factura
  assert.equal(t.payableCents, 10600); // transferencia al proveedor
});

test("computeExpenseTotals sin IRPF ni IVA (exento)", () => {
  const t = computeExpenseTotals(5000, 0, 0);
  assert.equal(t.totalCents, 5000);
  assert.equal(t.payableCents, 5000);
  assert.equal(t.irpfCents, 0);
});
