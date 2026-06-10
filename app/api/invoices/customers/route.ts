// app/api/invoices/customers/route.ts
// STAFF: libro de clientes recurrentes para autocompletar una factura nueva.
// Junta los clientes ya facturados (ClientInvoice) + los de plantillas
// recurrentes (RecurringInvoice), deduplica por NIF (o nombre fiscal si no hay
// NIF) y devuelve la ficha más reciente de cada uno.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

const clientSelect = {
  clientName: true,
  fiscalName: true,
  nif: true,
  address: true,
  city: true,
  postalCode: true,
  country: true,
  email: true,
} as const;

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const [invoices, recurring] = await Promise.all([
    prisma.clientInvoice.findMany({ orderBy: { createdAt: "desc" }, select: clientSelect, take: 1000 }),
    prisma.recurringInvoice.findMany({ orderBy: { createdAt: "desc" }, select: clientSelect }),
  ]);

  // Invoices primero (más recientes) → el primer match por clave gana.
  const seen = new Map<string, (typeof invoices)[number] & { key: string }>();
  for (const c of [...invoices, ...recurring]) {
    const fiscal = (c.fiscalName || "").trim();
    if (!fiscal) continue;
    const key = (c.nif || "").trim().toLowerCase() || fiscal.toLowerCase();
    if (seen.has(key)) continue;
    seen.set(key, { ...c, fiscalName: fiscal, key });
  }

  const customers = [...seen.values()].sort((a, b) => a.fiscalName.localeCompare(b.fiscalName, "es"));

  return NextResponse.json({ ok: true, customers });
}
