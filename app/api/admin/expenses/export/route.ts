// app/api/admin/expenses/export/route.ts — CSV del libro de facturas recibidas
// (gastos) para la gestoría, filtrable por periodo (year/q/m) sobre la fecha.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireStaffAccess } from "@/lib/staff-auth";
import { taxTreatmentLabel } from "@/lib/expense-math";

export const runtime = "nodejs";

function eur(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}
function csvCell(value: string) {
  const v = String(value ?? "");
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const q = url.searchParams.get("q");
  const m = url.searchParams.get("m");

  // needsReview=true = gasto recurrente pendiente de confirmar → fuera de la gestoría.
  const where: Prisma.ExpenseWhereInput = { needsReview: false };
  let tag = "";
  if (year && /^\d{4}$/.test(year)) {
    const y = Number(year);
    let s = 0;
    let e = 12;
    if (q && /^[1-4]$/.test(q)) {
      s = (Number(q) - 1) * 3;
      e = s + 3;
      tag = `-${year}-T${q}`;
    } else if (m && /^([1-9]|1[0-2])$/.test(m)) {
      s = Number(m) - 1;
      e = s + 1;
      tag = `-${year}-${String(Number(m)).padStart(2, "0")}`;
    } else {
      tag = `-${year}`;
    }
    where.date = { gte: new Date(Date.UTC(y, s, 1)), lt: new Date(Date.UTC(y, e, 1)) };
  }

  const rows = await prisma.expense.findMany({ where, orderBy: { date: "asc" } });

  const header = ["Fecha", "NumFacturaProveedor", "Proveedor", "NIF", "Concepto", "Categoria", "Base", "%IVA", "IVA", "IVADeducible", "Tratamiento IVA", "%IRPF", "IRPF", "Total", "APagar", "Notas", "Justificante"].join(";");
  const body = rows.map((r) =>
    [
      r.date.toISOString().slice(0, 10),
      r.supplierInvoiceNumber || "",
      r.supplier || "",
      r.supplierNif || "",
      r.concept,
      r.category || "",
      eur(r.baseCents),
      String(Math.round(r.vatRate * 100)),
      eur(r.vatCents),
      r.ivaDeducible ? "Si" : "No",
      taxTreatmentLabel(r.taxTreatment),
      String(Math.round(r.irpfRetentionPct * 100)),
      eur(r.irpfCents),
      eur(r.totalCents),
      eur(r.payableCents ?? r.totalCents),
      r.notes || "",
      r.attachmentUrl || "",
    ]
      .map(csvCell)
      .join(";")
  );

  const csv = "﻿" + [header, ...body].join("\r\n");
  return new NextResponse(csv, {
    status: 200,
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="gastos${tag}.csv"` },
  });
}
