// lib/bank-reconcile.ts — Motor PURO de conciliación bancaria (servidor).
// Cruza movimientos del extracto contra facturas emitidas, pedidos cobrados y
// gastos. No escribe nada (solo lee el snapshot). Determinista y testeable:
// sin imports de valor con alias @/ (norm y tolerancia inline; BankTxn type-only).

import { createHash } from "crypto";
import type { BankTxn } from "@/lib/bank-parse";

const DAY = 86400000;
const WINDOW_INCOME = 7 * DAY;
const WINDOW_EXPENSE = 14 * DAY;
// La liquidación se casa por su fecha de LLEGADA, que es la del extracto: basta
// un margen corto para el día de valor. No confundir con la distancia al cobro,
// que puede ser de 10 días y es justo lo que rompía el emparejamiento.
const WINDOW_PAYOUT = 3 * DAY;
const GATEWAY_FEE_MAX_PCT = 0.04;
export const TOLERANCE_CENTS = Math.min(500, Math.max(100, Number(process.env.RECONCILIATION_TOLERANCE_CENTS) || 300));

const INTERNAL_RE = /traspaso|cuenta propia|transferencia.*propia/i;
const REFUND_RE = /devoluci|reembolso|refund|abono.*tarjeta/i;
const BIZUM_RE = /bizum/i;

function normDesc(s: string): string {
  return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function computeLineHash(t: { bookingDate: string; amountCents: number; description: string }): string {
  const day = t.bookingDate.slice(0, 10);
  return createHash("sha256").update(`${day}|${t.amountCents}|${normDesc(t.description)}`).digest("hex");
}

export type SnapInvoice = { id: string; number: string | null; totalCents: number; issuedAt: string; fiscalName: string; nif: string | null; paidAt: string | null };
export type SnapOrder = { reference: string; amountCents: number; paidAt: string | null; createdAt: string; clientName: string | null; paymentStatus: string };
export type SnapExpense = { id: string; totalCents: number; date: string; supplier: string | null; concept: string; paidAt: string | null };
export type SnapDecision = { lineHash: string; status: string; matchedType: string | null; matchedId: string | null; note: string | null };
// Un payout de Stripe: lo que de verdad aparece en el extracto. `netCents` es el
// importe a casar (bruto − comisión) y `orders` las referencias que lo componen.
export type SnapPayout = {
  id: string;
  arrivalDate: string;
  netCents: number;
  grossCents: number;
  feeCents: number;
  orders: { reference: string; amountCents: number; clientName: string | null }[];
};
export type AccountingSnapshot = { invoices: SnapInvoice[]; orders: SnapOrder[]; expenses: SnapExpense[]; decisions: SnapDecision[]; payouts?: SnapPayout[] };

type Cand = { type: "invoice" | "order" | "expense"; id: string; label: string; diffCents: number; dateDist: number; flags: string[] };

export type MatchedItem = { txn: BankTxn; lineHash: string; kind: string; targetId: string; label: string; diffCents: number; flags: string[]; payout?: { id: string; grossCents: number; feeCents: number; orders: { reference: string; amountCents: number; clientName: string | null }[] } };
export type IncomeNoInvoice = { txn: BankTxn; lineHash: string; candidateOrder?: { reference: string; amountCents: number }; flags: string[] };
export type GapItem = { txn: BankTxn; lineHash: string; label?: string };
export type AmbiguousItem = { txn: BankTxn; lineHash: string; candidates: { type: string; id: string; label: string; diffCents: number }[] };
export type IgnoredItem = { txn: BankTxn; lineHash: string; note: string | null };

export type ReconResult = {
  matched: MatchedItem[];
  incomeNoInvoice: IncomeNoInvoice[];
  chargeNoExpense: GapItem[];
  internal: GapItem[];
  unmatchedIncome: GapItem[];
  // Ingresos por Bizum: fuera de la contabilidad general (apartado propio), no
  // cuentan como "sin factura" ni entran en gapIn.
  bizum: GapItem[];
  ambiguous: AmbiguousItem[];
  ignored: IgnoredItem[];
  totals: { bankIn: number; bankOut: number; matchedIn: number; matchedOut: number; gapIn: number; gapOut: number; bizumIn: number };
  balanceCheck: { ok: boolean; message: string };
  // Para vincular a mano un ingreso/cargo a un registro EXISTENTE no cobrado/pagado.
  availableInvoices: { id: string; label: string; totalCents: number }[];
  availableExpenses: { id: string; label: string; totalCents: number }[];
};

function within(a: number, b: number, tol: number) {
  return Math.abs(a - b) <= tol;
}

export function reconcile(txns: BankTxn[], snap: AccountingSnapshot): ReconResult {
  const decisions = new Map(snap.decisions.map((d) => [d.lineHash, d]));
  const usedInvoice = new Set<string>();
  const usedOrder = new Set<string>();
  const usedExpense = new Set<string>();
  const usedPayout = new Set<string>();

  const res: ReconResult = {
    matched: [],
    incomeNoInvoice: [],
    chargeNoExpense: [],
    internal: [],
    unmatchedIncome: [],
    bizum: [],
    ambiguous: [],
    ignored: [],
    totals: { bankIn: 0, bankOut: 0, matchedIn: 0, matchedOut: 0, gapIn: 0, gapOut: 0, bizumIn: 0 },
    balanceCheck: { ok: true, message: "" },
    availableInvoices: [],
    availableExpenses: [],
  };

  const seen = new Map<string, number>();
  for (const txn of txns) {
    const base = computeLineHash(txn);
    const occ = seen.get(base) || 0;
    seen.set(base, occ + 1);
    // Líneas idénticas (mismo día+importe+concepto) → hash distinto por ocurrencia,
    // para que una decisión no se aplique por error a todas.
    const lineHash = occ === 0 ? base : `${base}:${occ}`;
    const t = new Date(txn.bookingDate).getTime();
    const desc = normDesc(txn.description);
    if (txn.amountCents > 0) res.totals.bankIn += txn.amountCents;
    else res.totals.bankOut += -txn.amountCents;

    // Paso 0 — decisiones persistidas.
    const dec = decisions.get(lineHash);
    if (dec) {
      if (dec.status === "IGNORED") {
        res.ignored.push({ txn, lineHash, note: dec.note });
        continue;
      }
      if (dec.status === "MATCHED_MANUAL") {
        // Consumir el objetivo para que no se auto-empareje otra vez.
        if (dec.matchedId) {
          if (dec.matchedType === "invoice") usedInvoice.add(dec.matchedId);
          else if (dec.matchedType === "order") usedOrder.add(dec.matchedId);
          else if (dec.matchedType === "expense") usedExpense.add(dec.matchedId);
        }
        res.matched.push({ txn, lineHash, kind: dec.matchedType || "manual", targetId: dec.matchedId || "", label: "Emparejado a mano", diffCents: 0, flags: ["manual"] });
        if (txn.amountCents > 0) res.totals.matchedIn += txn.amountCents;
        else res.totals.matchedOut += -txn.amountCents;
        continue;
      }
    }

    if (txn.amountCents > 0) {
      // ── INGRESO ──────────────────────────────────────────
      // 0) LIQUIDACIÓN DE STRIPE. Va la PRIMERA porque explica la línea entera:
      //    importe neto exacto (bruto − comisión) y los N pedidos que lleva
      //    dentro. Antes se intentaba casar contra UN pedido con ±4 % y ventana
      //    de 7 días, y fallaba por las dos cosas: el payout agrupa varios
      //    cobros y llega hasta 10 días después. Aquí la fecha es la de LLEGADA
      //    al banco, que es la que trae el extracto.
      const payoutCands = (snap.payouts || [])
        .filter((p) => !usedPayout.has(p.id))
        .map((p) => ({ p, diff: Math.abs(txn.amountCents - p.netCents), dist: Math.abs(t - new Date(p.arrivalDate).getTime()) }))
        .filter((c) => c.diff <= TOLERANCE_CENTS && c.dist <= WINDOW_PAYOUT)
        .sort((a, b) => a.diff - b.diff || a.dist - b.dist);
      if (payoutCands.length >= 1) {
        const { p, diff } = payoutCands[0];
        usedPayout.add(p.id);
        for (const o of p.orders) usedOrder.add(o.reference);
        res.matched.push({
          txn,
          lineHash,
          kind: "stripe_payout",
          targetId: p.id,
          label: `Liquidación Stripe · ${p.orders.length} cobro${p.orders.length === 1 ? "" : "s"} · bruto ${(p.grossCents / 100).toFixed(2)} € − comisión ${(p.feeCents / 100).toFixed(2)} €`,
          diffCents: diff,
          flags: p.orders.length > 1 ? ["agrupado"] : [],
          payout: { id: p.id, grossCents: p.grossCents, feeCents: p.feeCents, orders: p.orders },
        });
        res.totals.matchedIn += txn.amountCents;
        continue;
      }

      // 1) Facturas emitidas (objetivo fiscal).
      const invCands: Cand[] = snap.invoices
        .filter((i) => !usedInvoice.has(i.id) && within(txn.amountCents, i.totalCents, TOLERANCE_CENTS) && Math.abs(t - new Date(i.issuedAt).getTime()) <= WINDOW_INCOME)
        .map((i) => ({
          type: "invoice" as const,
          id: i.id,
          label: `Factura ${i.number || "s/n"} · ${i.fiscalName}`,
          diffCents: Math.abs(txn.amountCents - i.totalCents),
          dateDist: Math.abs(t - new Date(i.issuedAt).getTime()),
          flags: i.number && desc.includes(normDesc(i.number)) ? ["ref-match"] : [],
        }))
        .sort((a, b) => a.diffCents - b.diffCents || a.dateDist - b.dateDist);

      if (invCands.length === 1) {
        usedInvoice.add(invCands[0].id);
        res.matched.push({ txn, lineHash, kind: "invoice", targetId: invCands[0].id, label: invCands[0].label, diffCents: invCands[0].diffCents, flags: invCands[0].flags });
        res.totals.matchedIn += txn.amountCents;
        continue;
      }
      if (invCands.length > 1) {
        res.ambiguous.push({ txn, lineHash, candidates: invCands.map((c) => ({ type: c.type, id: c.id, label: c.label, diffCents: c.diffCents })) });
        continue;
      }

      // 2) Pedidos cobrados sin factura → "cobro sin factura" (alimenta #2).
      const orderCands = snap.orders
        .filter((o) => o.paymentStatus === "PAID" && !usedOrder.has(o.reference))
        .map((o) => {
          const od = new Date(o.paidAt || o.createdAt).getTime();
          const exact = within(txn.amountCents, o.amountCents, TOLERANCE_CENTS);
          const netOfFee = txn.amountCents <= o.amountCents && txn.amountCents >= Math.round(o.amountCents * (1 - GATEWAY_FEE_MAX_PCT));
          return { o, od, ok: (exact || netOfFee) && Math.abs(t - od) <= WINDOW_INCOME, netOfFee: netOfFee && !exact, diff: Math.abs(txn.amountCents - o.amountCents) };
        })
        .filter((c) => c.ok)
        .sort((a, b) => a.diff - b.diff || Math.abs(t - a.od) - Math.abs(t - b.od));

      if (orderCands.length >= 1) {
        // Empate entre pedigos igual de buenos → ambiguo (no auto-elegir en silencio).
        if (orderCands.length > 1 && orderCands[0].diff === orderCands[1].diff) {
          res.ambiguous.push({
            txn,
            lineHash,
            candidates: orderCands.slice(0, 5).map((c) => ({ type: "order", id: c.o.reference, label: `Pedido ${c.o.reference}${c.o.clientName ? ` · ${c.o.clientName}` : ""}`, diffCents: c.diff })),
          });
          continue;
        }
        const best = orderCands[0];
        usedOrder.add(best.o.reference);
        res.incomeNoInvoice.push({
          txn,
          lineHash,
          candidateOrder: { reference: best.o.reference, amountCents: best.o.amountCents },
          flags: best.netOfFee ? ["netOfFee"] : [],
        });
        res.totals.gapIn += txn.amountCents;
        continue;
      }

      // 3) Sin candidato.
      if (INTERNAL_RE.test(desc)) res.internal.push({ txn, lineHash, label: "Interno" });
      else if (BIZUM_RE.test(desc)) {
        // Bizum: fuera de libros (regla 27-ago-2026) → apartado propio, sin hueco.
        res.bizum.push({ txn, lineHash, label: "Bizum" });
        res.totals.bizumIn += txn.amountCents;
      } else {
        res.unmatchedIncome.push({ txn, lineHash });
        res.totals.gapIn += txn.amountCents;
      }
    } else {
      // ── CARGO ────────────────────────────────────────────
      const abs = -txn.amountCents;
      if (INTERNAL_RE.test(desc)) {
        res.internal.push({ txn, lineHash, label: "Interno / traspaso" });
        continue;
      }
      // Devolución: cargo que casa con un pedido reembolsado (con ventana y consumo).
      const refundOrder = snap.orders.find(
        (o) =>
          o.paymentStatus === "REFUNDED" &&
          !usedOrder.has(o.reference) &&
          within(abs, o.amountCents, TOLERANCE_CENTS) &&
          Math.abs(t - new Date(o.paidAt || o.createdAt).getTime()) <= WINDOW_EXPENSE
      );
      if (refundOrder) usedOrder.add(refundOrder.reference);
      if (refundOrder || REFUND_RE.test(desc)) {
        res.internal.push({ txn, lineHash, label: "Devolución" });
        continue;
      }

      const expCands: Cand[] = snap.expenses
        .filter((e) => !usedExpense.has(e.id) && within(abs, e.totalCents, TOLERANCE_CENTS) && Math.abs(t - new Date(e.date).getTime()) <= WINDOW_EXPENSE)
        .map((e) => ({
          type: "expense" as const,
          id: e.id,
          label: `Gasto ${e.concept}${e.supplier ? ` · ${e.supplier}` : ""}`,
          diffCents: Math.abs(abs - e.totalCents),
          dateDist: Math.abs(t - new Date(e.date).getTime()),
          flags: e.supplier && desc.includes(normDesc(e.supplier)) ? ["supplier-match"] : [],
        }))
        .sort((a, b) => a.diffCents - b.diffCents || a.dateDist - b.dateDist);

      if (expCands.length === 1) {
        usedExpense.add(expCands[0].id);
        res.matched.push({ txn, lineHash, kind: "expense", targetId: expCands[0].id, label: expCands[0].label, diffCents: expCands[0].diffCents, flags: expCands[0].flags });
        res.totals.matchedOut += abs;
        continue;
      }
      if (expCands.length > 1) {
        res.ambiguous.push({ txn, lineHash, candidates: expCands.map((c) => ({ type: c.type, id: c.id, label: c.label, diffCents: c.diffCents })) });
        continue;
      }
      res.chargeNoExpense.push({ txn, lineHash });
      res.totals.gapOut += abs;
    }
  }

  // Facturas/gastos EXISTENTES aún no cobrados/pagados y no emparejados ya:
  // candidatos para vincular a mano un ingreso/cargo sin identificar.
  res.availableInvoices = snap.invoices
    .filter((i) => !i.paidAt && !usedInvoice.has(i.id))
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
    .map((i) => ({
      id: i.id,
      label: `${i.number || "borrador"} · ${i.fiscalName} · ${(i.totalCents / 100).toFixed(2)} €`,
      totalCents: i.totalCents,
    }));
  res.availableExpenses = snap.expenses
    .filter((e) => !e.paidAt && !usedExpense.has(e.id))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((e) => ({
      id: e.id,
      label: `${e.concept}${e.supplier ? ` · ${e.supplier}` : ""} · ${(e.totalCents / 100).toFixed(2)} €`,
      totalCents: e.totalCents,
    }));

  res.balanceCheck = checkBalance(txns);
  return res;
}

// "Que no falte nada": si hay columna saldo, cada saldo encadena con el anterior.
// Se valida en el ORDEN DEL FICHERO (los bancos exportan ordenado), probando tanto
// ascendente (antiguo→nuevo) como descendente (nuevo→antiguo) para no dar falsos
// positivos con extractos en cualquier sentido o con varios movimientos el mismo día.
function checkBalance(txns: BankTxn[]): { ok: boolean; message: string } {
  const withBal = txns.filter((t) => typeof t.balanceCents === "number");
  if (withBal.length < 2 || withBal.length !== txns.length) {
    return { ok: true, message: "Sin columna de saldo: no se puede verificar continuidad." };
  }
  const bal = (i: number) => txns[i].balanceCents as number;
  // asc (antiguo→nuevo): saldo[i] = saldo[i-1] + importe[i].
  const asc = txns.every((t, i) => i === 0 || Math.abs(bal(i - 1) + t.amountCents - bal(i)) <= 1);
  // desc (nuevo→antiguo): saldo[i] = saldo[i-1] − importe[i-1].
  const desc = txns.every((t, i) => i === 0 || Math.abs(bal(i - 1) - txns[i - 1].amountCents - bal(i)) <= 1);
  if (asc || desc) return { ok: true, message: "Saldos continuos: el extracto está completo." };
  return { ok: false, message: "Salto de saldo: faltan movimientos o el orden no es cronológico." };
}
