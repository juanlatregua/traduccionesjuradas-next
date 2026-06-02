// app/api/recurring-invoices/[id]/route.ts — STAFF ADMIN/PM: editar/borrar plantilla.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { updateRecurring, deleteRecurring, type RecurringInput } from "@/lib/recurring-invoice";

export const runtime = "nodejs";

type Params = { params: { id: string } };

async function gate(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return { ok: false as const, status: 403, error: access.error };
  const role = getStaffRole(access.email);
  if (role !== "ADMIN" && role !== "PM") return { ok: false as const, status: 403, error: "Solo ADMIN/PM." };
  return { ok: true as const };
}

export async function PATCH(req: Request, { params }: Params) {
  const g = await gate(req);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  let body: Partial<RecurringInput> = {};
  try {
    body = (await req.json()) as Partial<RecurringInput>;
  } catch {
    /* opcional */
  }
  try {
    const template = await updateRecurring(params.id, {
      label: String(body.label || ""),
      active: body.active,
      brand: body.brand,
      clientName: body.clientName,
      fiscalName: String(body.fiscalName || ""),
      nif: body.nif,
      address: body.address,
      city: body.city,
      postalCode: body.postalCode,
      country: body.country,
      email: body.email,
      conceptTemplate: body.conceptTemplate,
      poNumber: body.poNumber,
      langPair: body.langPair,
      lines: body.lines || [],
      vatRate: body.vatRate ?? 0.21,
      dayOfMonth: body.dayOfMonth ?? 1,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, template });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo actualizar." }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const g = await gate(req);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  try {
    await deleteRecurring(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo borrar." }, { status: 400 });
  }
}
