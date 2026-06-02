// app/api/admin/invoices/export/route.ts
// Export contable de facturas emitidas (ClientInvoice) para la gestoría.
// CSV con separador ';' y decimales con coma (Excel ES). Filtro opcional por
// año (?year=2026). Solo staff.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireStaffAccess } from "@/lib/staff-auth";

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
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const q = url.searchParams.get("q"); // 1..4
  const m = url.searchParams.get("m"); // 1..12

  // Solo facturas EMITIDAS (los borradores no van a la gestoría). Filtro por
  // periodo contable sobre la fecha de EMISIÓN (issuedAt).
  const where: Prisma.ClientInvoiceWhereInput = { status: "ISSUED" };
  let periodTag = "";
  if (year && /^\d{4}$/.test(year)) {
    const y = Number(year);
    let startMonth = 0;
    let endMonth = 12;
    if (q && /^[1-4]$/.test(q)) {
      startMonth = (Number(q) - 1) * 3;
      endMonth = startMonth + 3;
      periodTag = `-${year}-T${q}`;
    } else if (m && /^([1-9]|1[0-2])$/.test(m)) {
      startMonth = Number(m) - 1;
      endMonth = startMonth + 1;
      periodTag = `-${year}-${String(Number(m)).padStart(2, "0")}`;
    } else {
      periodTag = `-${year}`;
    }
    where.issuedAt = { gte: new Date(Date.UTC(y, startMonth, 1)), lt: new Date(Date.UTC(y, endMonth, 1)) };
  }

  const invoices = await prisma.clientInvoice.findMany({
    where,
    orderBy: { number: "asc" },
    include: { order: { select: { reference: true } } },
  });

  const header = [
    "Numero",
    "Fecha",
    "Pedido",
    "Cliente",
    "NIF",
    "Base imponible",
    "IVA %",
    "Cuota IVA",
    "Total",
    "Email",
  ].join(";");

  const rows = invoices.map((inv) =>
    [
      inv.number || "",
      (inv.issuedAt || inv.createdAt).toISOString().slice(0, 10),
      inv.order?.reference || "",
      inv.fiscalName,
      inv.nif || "",
      eur(inv.baseCents),
      String(Math.round(inv.vatRate * 100)),
      eur(inv.vatCents),
      eur(inv.totalCents),
      inv.email || "",
    ]
      .map(csvCell)
      .join(";")
  );

  const csv = "﻿" + [header, ...rows].join("\r\n"); // BOM para Excel
  const filename = `facturas${periodTag}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
