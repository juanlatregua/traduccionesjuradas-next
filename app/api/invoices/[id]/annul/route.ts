// app/api/invoices/[id]/annul/route.ts — ADMIN/PM: registro de ANULACIÓN de una
// factura emitida (RD 1007/2023). La fila se conserva; motivo obligatorio.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { annulInvoice } from "@/lib/client-invoice";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  const role = getStaffRole(access.email);
  if (role !== "ADMIN" && role !== "PM") {
    return NextResponse.json({ ok: false, error: "Solo ADMIN/PM puede anular una factura." }, { status: 403 });
  }
  let body: { reason?: string; confirm?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  if (body.confirm !== true) return NextResponse.json({ ok: false, error: "Falta confirm:true." }, { status: 400 });
  try {
    const invoice = await annulInvoice(params.id, access.email, String(body.reason || ""));
    return NextResponse.json({ ok: true, invoice });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo anular." }, { status: 400 });
  }
}
