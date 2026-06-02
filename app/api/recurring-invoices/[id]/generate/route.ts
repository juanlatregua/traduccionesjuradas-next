// app/api/recurring-invoices/[id]/generate/route.ts — STAFF ADMIN/PM: genera el
// BORRADOR del periodo desde la plantilla. NUNCA emite.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { generateDraftForPeriod } from "@/lib/recurring-invoice";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  const role = getStaffRole(access.email);
  if (role !== "ADMIN" && role !== "PM") return NextResponse.json({ ok: false, error: "Solo ADMIN/PM." }, { status: 403 });

  let body: { period?: string; force?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }
  try {
    const result = await generateDraftForPeriod(params.id, { period: body.period, force: body.force });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo generar." }, { status: 400 });
  }
}
