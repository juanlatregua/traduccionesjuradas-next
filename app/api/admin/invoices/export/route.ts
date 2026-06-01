// app/api/admin/invoices/export/route.ts
// Export contable de facturas emitidas (ClientInvoice) para la gestoría.
// CSV con separador ';' y decimales con coma (Excel ES). Filtro opcional por
// año (?year=2026). Solo staff.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
  // Solo facturas EMITIDAS (los borradores no van a la gestoría). Filtro por año
  // sobre el prefijo del número AA_NNN (p.ej. 2026 → "26_").
  const where =
    year && /^\d{4}$/.test(year)
      ? { status: "ISSUED", number: { startsWith: `${year.slice(2)}_` } }
      : { status: "ISSUED" };

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
  const filename = `facturas${year ? `-${year}` : ""}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
