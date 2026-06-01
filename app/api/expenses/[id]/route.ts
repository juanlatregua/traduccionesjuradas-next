// app/api/expenses/[id]/route.ts — STAFF: editar / borrar gasto manual.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { updateExpense, deleteExpense, type ExpenseInput } from "@/lib/expenses";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: Partial<ExpenseInput> = {};
  try {
    body = (await req.json()) as Partial<ExpenseInput>;
  } catch {
    /* opcional */
  }
  if (!body.date) return NextResponse.json({ ok: false, error: "Falta la fecha." }, { status: 400 });

  try {
    const expense = await updateExpense(params.id, {
      date: String(body.date),
      brand: body.brand,
      supplier: body.supplier,
      supplierNif: body.supplierNif,
      concept: String(body.concept || ""),
      category: body.category,
      baseCents: Number(body.baseCents) || 0,
      vatRate: body.vatRate ?? 0.21,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, expense });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo actualizar." }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  try {
    await deleteExpense(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo borrar." }, { status: 400 });
  }
}
