// app/api/customers/route.ts
// STAFF: agenda de clientes (modelo Customer) para elegir al crear un presupuesto.
// Incluye los clientes creados por upsert desde presupuestos + las fichas B2B
// con pack fiscal (p.ej. Auream).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const customers = await prisma.customer.findMany({
    orderBy: [{ companyName: "asc" }, { name: "asc" }],
    take: 1000,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      companyName: true,
      fiscalName: true,
      nif: true,
      isBusiness: true,
    },
  });

  return NextResponse.json({ ok: true, customers });
}
