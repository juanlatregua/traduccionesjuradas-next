// app/api/invoices/import/route.ts — STAFF: importar facturas históricas (CSV
// parseado en cliente) como facturas EMITIDAS. Crea fila a fila y reporta errores.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { importIssuedInvoice, type ImportInvoiceRow } from "@/lib/client-invoice";

export const runtime = "nodejs";

const MAX_ROWS = 1000;

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: { rows?: ImportInvoiceRow[] } = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "No hay filas que importar." }, { status: 400 });
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ ok: false, error: `Máximo ${MAX_ROWS} filas por importación.` }, { status: 400 });
  }

  let created = 0;
  const errors: { number: string; error: string }[] = [];
  for (const row of rows) {
    try {
      await importIssuedInvoice(row);
      created += 1;
    } catch (err: any) {
      errors.push({ number: String(row?.number || "?"), error: err?.message || "error" });
    }
  }

  return NextResponse.json({ ok: true, created, failed: errors.length, errors });
}
