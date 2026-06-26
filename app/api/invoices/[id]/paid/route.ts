// app/api/invoices/[id]/paid/route.ts
// STAFF ADMIN/PM: marca una factura emitida como cobrada (sella paidAt) o pendiente
// (lo limpia). Complemento manual a la conciliación bancaria (efectivo, o movimiento
// que no se importa). Usa el helper único setInvoicePaid — el MISMO camino y guarda
// que /api/bank/decision — para que solo exista una fuente de verdad del cobro.

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { setInvoicePaid } from "@/lib/client-invoice";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  const role = getStaffRole(access.email);
  if (role !== "ADMIN" && role !== "PM") {
    return NextResponse.json({ ok: false, error: "Solo ADMIN/PM." }, { status: 403 });
  }

  let body: { paid?: boolean; date?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }

  const markPaid = body.paid !== false; // por defecto marca como cobrada
  const when: Date | null = markPaid
    ? body.date && !isNaN(new Date(body.date).getTime())
      ? new Date(body.date)
      : new Date()
    : null;

  try {
    const updated = await setInvoicePaid(params.id, when);
    return NextResponse.json({
      ok: true,
      invoice: { id: updated.id, paidAt: updated.paidAt ? updated.paidAt.toISOString() : null },
    });
  } catch (err: any) {
    const msg = err?.message || "No se pudo actualizar la factura.";
    const status = msg.includes("no encontrada") ? 404 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
