// app/api/expenses/route.ts — STAFF: crear gasto manual.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { createExpense, type ExpenseInput } from "@/lib/expenses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: Partial<ExpenseInput> = {};
  try {
    body = (await req.json()) as Partial<ExpenseInput>;
  } catch {
    /* opcional */
  }

  if (!body.date) return NextResponse.json({ ok: false, error: "Falta la fecha." }, { status: 400 });
  if (!String(body.concept || "").trim()) {
    return NextResponse.json({ ok: false, error: "Falta el concepto." }, { status: 400 });
  }

  try {
    const expense = await createExpense({
      date: String(body.date),
      brand: body.brand,
      supplier: body.supplier,
      supplierNif: body.supplierNif,
      concept: String(body.concept),
      category: body.category,
      baseCents: Number(body.baseCents) || 0,
      vatRate: body.vatRate ?? 0.21,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, expense });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo crear el gasto." }, { status: 400 });
  }
}
