// scripts/bank-reconcile-report.mjs — SOLO LECTURA.
// Corre el motor de conciliación de la app (lib/bank-reconcile) contra el
// extracto BBVA y reporta: emparejados, cobros sin factura, ingresos sin
// identificar (posibles Stripe/transferencia no facturados), cargos sin gasto.
//
//   node --experimental-strip-types --loader ./scripts/alias-loader.mjs \
//        scripts/bank-reconcile-report.mjs "<ruta CSV>"
//
// Combina Concepto+Observaciones como descripción (BBVA pone la ref de factura
// en Observaciones). No escribe nada.

import { readFileSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  try {
    for (const l of readFileSync(f, "utf8").split("\n")) {
      const m = l.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
      if (m && !process.env.DATABASE_URL) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const CSV = process.argv[2];
if (!CSV) { console.error("Falta la ruta del CSV."); process.exit(1); }

const { splitCsvLine, toCents, parseDateFlexible, detectDelimiter } = await import("@/lib/csv.ts");
const { reconcile } = await import("@/lib/bank-reconcile.ts");
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

// ── Parse BBVA: Fecha Proceso,Fecha Valor,Código,Concepto,Observaciones,Oficina,Importe,Saldo,Remesa ──
const text = readFileSync(CSV, "utf8");
const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
const delim = detectDelimiter(lines[0]);
const headers = splitCsvLine(lines[0], delim).map((h) => h.toLowerCase().trim());
const col = (name) => headers.findIndex((h) => h === name);
const iDate = col("fecha valor") >= 0 ? col("fecha valor") : col("fecha proceso");
const iConcepto = col("concepto");
const iObs = col("observaciones");
const iImporte = col("importe");
const iSaldo = col("saldo");

const txns = [];
for (const line of lines.slice(1)) {
  const c = splitCsvLine(line, delim);
  const d = parseDateFlexible(c[iDate] || "");
  if (!d) continue;
  const amt = toCents(c[iImporte] || "");
  if (!amt) continue;
  const desc = [c[iConcepto], c[iObs]].map((s) => (s || "").trim()).filter(Boolean).join(" · ");
  txns.push({
    bookingDate: d.toISOString(),
    description: desc,
    amountCents: amt,
    balanceCents: (c[iSaldo] || "").trim() ? toCents(c[iSaldo]) : null,
  });
}

const [invoices, orders, expenses, decisions] = await Promise.all([
  prisma.clientInvoice.findMany({ where: { status: "ISSUED" }, select: { id: true, number: true, totalCents: true, issuedAt: true, createdAt: true, fiscalName: true, nif: true, paidAt: true }, take: 5000 }),
  prisma.order.findMany({ where: { paymentStatus: { in: ["PAID", "REFUNDED"] } }, select: { reference: true, amountCents: true, paidAt: true, createdAt: true, clientName: true, paymentStatus: true }, take: 5000 }),
  prisma.expense.findMany({ where: { isAccrual: false }, select: { id: true, totalCents: true, date: true, supplier: true, concept: true, paidAt: true }, take: 5000 }),
  prisma.bankDecision.findMany({ select: { lineHash: true, status: true, matchedType: true, matchedId: true, note: true } }),
]);

const snap = {
  invoices: invoices.map((i) => ({ id: i.id, number: i.number, totalCents: i.totalCents, issuedAt: (i.issuedAt ?? i.createdAt).toISOString(), fiscalName: i.fiscalName, nif: i.nif, paidAt: i.paidAt ? i.paidAt.toISOString() : null })),
  orders: orders.map((o) => ({ reference: o.reference, amountCents: o.amountCents, paidAt: o.paidAt ? o.paidAt.toISOString() : null, createdAt: o.createdAt.toISOString(), clientName: o.clientName, paymentStatus: o.paymentStatus })),
  expenses: expenses.map((e) => ({ id: e.id, totalCents: e.totalCents, date: e.date.toISOString(), supplier: e.supplier, concept: e.concept, paidAt: e.paidAt ? e.paidAt.toISOString() : null })),
  decisions,
};

const r = reconcile(txns, snap);
const eur = (c) => (c / 100).toFixed(2).padStart(9);
const day = (t) => t.bookingDate.slice(0, 10);

console.log(`\n=== EXTRACTO: ${txns.length} movimientos · ${headers.length} columnas ===`);
console.log(`Saldo: ${r.balanceCheck.ok ? "✓" : "✗"} ${r.balanceCheck.message}`);
console.log(`Banco  entradas ${eur(r.totals.bankIn)}   salidas ${eur(r.totals.bankOut)}`);

console.log(`\n── EMPAREJADOS (${r.matched.length}) ──`);
for (const m of r.matched) console.log(`  ${day(m.txn)} ${eur(m.txn.amountCents)}  ${m.kind.padEnd(8)} ${m.label}  ${m.flags.length ? "["+m.flags.join(",")+"]" : ""}`);

console.log(`\n── COBROS SIN FACTURA (pedido cobrado, factura no emitida) (${r.incomeNoInvoice.length}) ──`);
for (const x of r.incomeNoInvoice) console.log(`  ${day(x.txn)} ${eur(x.txn.amountCents)}  pedido ${x.candidateOrder?.reference}  ${x.flags.join(",")}  «${x.txn.description}»`);

console.log(`\n── INGRESOS SIN IDENTIFICAR (¿Stripe/transferencia no facturada?) (${r.unmatchedIncome.length}) ──`);
for (const x of r.unmatchedIncome) console.log(`  ${day(x.txn)} ${eur(x.txn.amountCents)}  ${x.label || ""}  «${x.txn.description}»`);

console.log(`\n── AMBIGUOS (${r.ambiguous.length}) ──`);
for (const x of r.ambiguous) console.log(`  ${day(x.txn)} ${eur(x.txn.amountCents)}  «${x.txn.description}»  → ${x.candidates.map((c) => c.label + " (" + (c.diffCents/100).toFixed(2) + ")").join(" | ")}`);

console.log(`\n── CARGOS SIN GASTO (${r.chargeNoExpense.length}) ──`);
for (const x of r.chargeNoExpense) console.log(`  ${day(x.txn)} ${eur(x.txn.amountCents)}  «${x.txn.description}»`);

console.log(`\n── INTERNOS/DEVOLUCIONES (${r.internal.length}) ──`);
for (const x of r.internal) console.log(`  ${day(x.txn)} ${eur(x.txn.amountCents)}  ${x.label}  «${x.txn.description}»`);

console.log(`\n── FACTURAS EMITIDAS SIN COBRAR (pendientes) (${r.availableInvoices.length}) ──`);
for (const x of r.availableInvoices) console.log(`  ${x.label}`);

await prisma.$disconnect();
