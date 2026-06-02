// app/api/recurring-invoices/route.ts — STAFF ADMIN/PM: plantillas recurrentes.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { listRecurring, createRecurring, type RecurringInput } from "@/lib/recurring-invoice";

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
  return NextResponse.json({ ok: true, templates: await listRecurring() });
}

export async function POST(req: Request) {
  const g = await gate(req);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  let body: Partial<RecurringInput> = {};
  try {
    body = (await req.json()) as Partial<RecurringInput>;
  } catch {
    /* opcional */
  }
  try {
    const template = await createRecurring({
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
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo crear." }, { status: 400 });
  }
}
