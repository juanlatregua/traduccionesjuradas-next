// app/api/invoices/[id]/rectify/route.ts — STAFF: crea el BORRADOR de factura
// rectificativa (R1, por diferencias) de una factura emitida. No toca la original.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { createRectificativeDraft } from "@/lib/client-invoice";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  let body: { reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }
  try {
    const draft = await createRectificativeDraft(params.id, access.email, body.reason?.trim() || null);
    return NextResponse.json({ ok: true, draft });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo crear la rectificativa." }, { status: 400 });
  }
}
