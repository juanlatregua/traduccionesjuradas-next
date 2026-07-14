// app/api/admin/expenses/export/route.ts — CSV del libro de facturas recibidas
// (gastos) para la gestoría, filtrable por periodo (year/q/m) sobre la fecha.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireStaffAccess } from "@/lib/staff-auth";
import { buildExpensesCsv } from "@/lib/gestoria-csv";
import { parseFiscalPeriod } from "@/lib/fiscal-period";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const url = new URL(req.url);
  // needsReview=true = gasto recurrente pendiente de confirmar → fuera de la gestoría.
  const where: Prisma.ExpenseWhereInput = { needsReview: false };
  const period = parseFiscalPeriod(url);
  const tag = period ? `-${period.tag}` : "";
  if (period) where.date = { gte: period.gte, lt: period.lt };

  const rows = await prisma.expense.findMany({ where, orderBy: { date: "asc" } });

  const csv = buildExpensesCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="gastos${tag}.csv"` },
  });
}
