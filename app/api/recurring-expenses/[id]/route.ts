// app/api/recurring-expenses/[id]/route.ts — STAFF ADMIN/PM: editar/borrar plantilla de gasto.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { updateRecurringExpense, deleteRecurringExpense, type RecurringExpenseInput } from "@/lib/recurring-expense";

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

  let body: Partial<RecurringExpenseInput> = {};
  try {
    body = (await req.json()) as Partial<RecurringExpenseInput>;
  } catch {
    /* opcional */
  }
  try {
    const template = await updateRecurringExpense(params.id, {
      label: String(body.label || ""),
      active: body.active,
      brand: body.brand,
      supplier: body.supplier,
      supplierNif: body.supplierNif,
      category: body.category,
      conceptTemplate: body.conceptTemplate,
      lines: body.lines,
      vatRate: body.vatRate ?? 0.21,
      taxTreatment: body.taxTreatment,
      irpfRetentionPct: body.irpfRetentionPct,
      amountCents: body.amountCents,
      dayOfMonth: body.dayOfMonth ?? 1,
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
    await deleteRecurringExpense(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo borrar." }, { status: 400 });
  }
}
