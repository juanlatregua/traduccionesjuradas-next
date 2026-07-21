// app/api/expenses/collaborator-invoice/route.ts — STAFF ADMIN/PM: registra la
// factura real de un colaborador (mensual o puntual) y liquida sus devengos.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import {
  registerCollaboratorInvoice,
  AccrualMismatchError,
  DuplicateExpenseError,
  type CollaboratorInvoiceInput,
} from "@/lib/expenses";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  // Finanzas = solo ADMIN/PM (mismo patrón que supplier-invoice y bank/decision).
  const role = getStaffRole(access.email);
  if (role !== "ADMIN" && role !== "PM") {
    return NextResponse.json({ ok: false, error: "Solo ADMIN/PM puede registrar facturas de colaborador." }, { status: 403 });
  }

  let body: Partial<CollaboratorInvoiceInput> = {};
  try {
    body = (await req.json()) as Partial<CollaboratorInvoiceInput>;
  } catch {
    /* opcional */
  }

  if (!body.collaboratorId) return NextResponse.json({ ok: false, error: "Falta el colaborador." }, { status: 400 });
  if (!Array.isArray(body.accrualIds) || body.accrualIds.length === 0) {
    return NextResponse.json({ ok: false, error: "No hay devengos seleccionados." }, { status: 400 });
  }
  if (!body.date) return NextResponse.json({ ok: false, error: "Falta la fecha de la factura." }, { status: 400 });

  try {
    const result = await registerCollaboratorInvoice({
      collaboratorId: String(body.collaboratorId),
      accrualIds: body.accrualIds.map(String),
      number: String(body.number || ""),
      date: String(body.date),
      baseCents: body.baseCents != null ? Number(body.baseCents) : undefined,
      vatRate: body.vatRate ?? 0.21,
      irpfRetentionPct: body.irpfRetentionPct,
      supplierNif: body.supplierNif,
      notes: body.notes,
      acceptMismatch: body.acceptMismatch === true,
      force: body.force === true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    if (err instanceof AccrualMismatchError) {
      return NextResponse.json(
        { ok: false, error: err.message, mismatch: { expectedCents: err.expectedCents, gotCents: err.gotCents } },
        { status: 409 }
      );
    }
    if (err instanceof DuplicateExpenseError) {
      return NextResponse.json({ ok: false, error: err.message, duplicate: err.existing }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo registrar la factura." }, { status: 400 });
  }
}
