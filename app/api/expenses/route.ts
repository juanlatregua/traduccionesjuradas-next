// app/api/expenses/route.ts — STAFF: crear gasto manual.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { createExpense, DuplicateExpenseError, type ExpenseInput } from "@/lib/expenses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: Partial<ExpenseInput> & { force?: boolean } = {};
  try {
    body = (await req.json()) as Partial<ExpenseInput> & { force?: boolean };
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
      supplierInvoiceNumber: body.supplierInvoiceNumber,
      concept: String(body.concept),
      category: body.category,
      baseCents: Number(body.baseCents) || 0,
      vatRate: body.vatRate ?? 0.21,
      ivaDeducible: body.ivaDeducible,
      taxTreatment: body.taxTreatment,
      needsReview: body.needsReview,
      irpfRetentionPct: body.irpfRetentionPct,
      attachmentUrl: body.attachmentUrl,
      attachmentKey: body.attachmentKey,
      attachmentName: body.attachmentName,
      notes: body.notes,
    }, { force: body.force === true });
    return NextResponse.json({ ok: true, expense });
  } catch (err: any) {
    if (err instanceof DuplicateExpenseError) {
      return NextResponse.json({ ok: false, error: err.message, duplicate: err.existing }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo crear el gasto." }, { status: 400 });
  }
}
