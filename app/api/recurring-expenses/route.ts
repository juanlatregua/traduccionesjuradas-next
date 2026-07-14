// app/api/recurring-expenses/route.ts — STAFF ADMIN/PM: plantillas de gastos recurrentes.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { listRecurringExpenses, createRecurringExpense, type RecurringExpenseInput } from "@/lib/recurring-expense";

export const runtime = "nodejs";

async function gate(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return { ok: false as const, status: 403, error: access.error };
  const role = getStaffRole(access.email);
  if (role !== "ADMIN" && role !== "PM") return { ok: false as const, status: 403, error: "Solo ADMIN/PM." };
  return { ok: true as const };
}

export async function GET(req: Request) {
  const g = await gate(req);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });
  return NextResponse.json({ ok: true, templates: await listRecurringExpenses() });
}

export async function POST(req: Request) {
  const g = await gate(req);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  let body: Partial<RecurringExpenseInput> = {};
  try {
    body = (await req.json()) as Partial<RecurringExpenseInput>;
  } catch {
    /* opcional */
  }
  try {
    const template = await createRecurringExpense({
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
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo crear." }, { status: 400 });
  }
}
