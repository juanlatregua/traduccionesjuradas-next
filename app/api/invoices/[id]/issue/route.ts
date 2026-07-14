// app/api/invoices/[id]/issue/route.ts
// STAFF: emite un borrador → asigna número fiscal AA_NNN (auto o manual) y lo congela.

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { issueInvoice } from "@/lib/client-invoice";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: { number?: string | null; issuedAt?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }

  // Fecha de emisión opcional (p.ej. la del cobro); si no llega, issueInvoice sella con hoy.
  let issuedAt: Date | undefined;
  if (body.issuedAt) {
    const d = new Date(body.issuedAt);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha de emisión inválida." }, { status: 400 });
    }
    issuedAt = d;
  }

  try {
    const invoice = await issueInvoice(params.id, { number: body.number, issuedAt });
    return NextResponse.json({ ok: true, invoice });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo emitir." }, { status: 400 });
  }
}
