// app/api/bank/reconcile/route.ts — STAFF: cruza los movimientos del extracto
// (parseados en cliente) contra facturas/pedidos/gastos. NO escribe nada.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { reconcile, type AccountingSnapshot } from "@/lib/bank-reconcile";
import { inBooksOrderWhere } from "@/lib/bizum-ledger";
import type { BankTxn } from "@/lib/bank-parse";

export const runtime = "nodejs";

const MAX_ROWS = 5000;

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: { rows?: BankTxn[] } = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }
  const raw = Array.isArray(body.rows) ? body.rows : [];
  if (raw.length > MAX_ROWS) return NextResponse.json({ ok: false, error: `Máximo ${MAX_ROWS} movimientos.` }, { status: 400 });
  // Sanear: descartar filas sin fecha parseable o sin importe; coaccionar números.
  const rows: BankTxn[] = raw
    .map((r: any) => ({
      bookingDate: String(r?.bookingDate || ""),
      description: String(r?.description || ""),
      amountCents: Math.round(Number(r?.amountCents)),
      balanceCents: Number.isFinite(Number(r?.balanceCents)) && r?.balanceCents != null ? Math.round(Number(r.balanceCents)) : null,
    }))
    .filter((r) => r.bookingDate && !isNaN(new Date(r.bookingDate).getTime()) && Number.isFinite(r.amountCents) && r.amountCents !== 0);
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "No hay movimientos válidos." }, { status: 400 });

  const [invoices, orders, expenses, decisions] = await Promise.all([
    prisma.clientInvoice.findMany({
      where: { status: "ISSUED" },
      select: { id: true, number: true, totalCents: true, issuedAt: true, createdAt: true, fiscalName: true, nif: true, paidAt: true },
      take: 5000,
    }),
    // Bizum y apartados quedan fuera de la conciliación (van a su apartado propio).
    prisma.order.findMany({
      where: { paymentStatus: { in: ["PAID", "REFUNDED"] }, AND: [inBooksOrderWhere()] },
      select: { reference: true, amountCents: true, paidAt: true, createdAt: true, clientName: true, paymentStatus: true },
      take: 5000,
    }),
    // Los devengos de colaborador (isAccrual) no se concilian con el banco:
    // lo que se paga es la factura real del traductor.
    prisma.expense.findMany({ where: { isAccrual: false }, select: { id: true, totalCents: true, date: true, supplier: true, concept: true, paidAt: true }, take: 5000 }),
    prisma.bankDecision.findMany({ select: { lineHash: true, status: true, matchedType: true, matchedId: true, note: true } }),
  ]);

  const snap: AccountingSnapshot = {
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.number,
      totalCents: i.totalCents,
      issuedAt: (i.issuedAt ?? i.createdAt).toISOString(),
      fiscalName: i.fiscalName,
      nif: i.nif,
      paidAt: i.paidAt ? i.paidAt.toISOString() : null,
    })),
    orders: orders.map((o) => ({
      reference: o.reference,
      amountCents: o.amountCents,
      paidAt: o.paidAt ? o.paidAt.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
      clientName: o.clientName,
      paymentStatus: o.paymentStatus,
    })),
    expenses: expenses.map((e) => ({ id: e.id, totalCents: e.totalCents, date: e.date.toISOString(), supplier: e.supplier, concept: e.concept, paidAt: e.paidAt ? e.paidAt.toISOString() : null })),
    decisions,
  };

  const result = reconcile(rows, snap);
  return NextResponse.json({ ok: true, result });
}
