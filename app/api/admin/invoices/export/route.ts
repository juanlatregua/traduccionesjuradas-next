// app/api/admin/invoices/export/route.ts
// Export contable de facturas emitidas (ClientInvoice) para la gestoría.
// CSV con separador ';' y decimales con coma (Excel ES). Filtro opcional por
// año (?year=2026). Solo staff.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { requireStaffAccess } from "@/lib/staff-auth";
import { buildInvoicesCsv } from "@/lib/gestoria-csv";
import { parseFiscalPeriod } from "@/lib/fiscal-period";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const url = new URL(req.url);
  // Solo facturas EMITIDAS (los borradores no van a la gestoría). Filtro por
  // periodo contable sobre la fecha de EMISIÓN (issuedAt).
  const where: Prisma.ClientInvoiceWhereInput = { status: "ISSUED", docKind: "invoice" };
  const period = parseFiscalPeriod(url);
  const periodTag = period ? `-${period.tag}` : "";
  if (period) where.issuedAt = { gte: period.gte, lt: period.lt };

  const invoices = await prisma.clientInvoice.findMany({
    where,
    orderBy: { number: "asc" },
    include: { order: { select: { reference: true } } },
  });

  const csv = buildInvoicesCsv(invoices);
  const filename = `facturas${periodTag}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
