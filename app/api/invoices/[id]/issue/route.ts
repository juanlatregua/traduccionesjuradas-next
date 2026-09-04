// app/api/invoices/[id]/issue/route.ts
// STAFF: emite un borrador → asigna número fiscal AA_NNN (auto o manual) y lo congela.

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { issueInvoice } from "@/lib/client-invoice";
import { issueMonthlyInvoice, CreditError } from "@/lib/credit";
import { prisma } from "@/lib/prisma";

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
    // Factura AGRUPADA del mes: mismo botón "Emitir", pero pasa por el carril
    // de crédito (vencimiento + rastro en cada pedido). Sin número manual.
    const meta = await prisma.clientInvoice.findUnique({ where: { id: params.id }, select: { periodKey: true } });
    if (meta?.periodKey) {
      const r = await issueMonthlyInvoice({ invoiceId: params.id, actorEmail: access.email, issuedAt: issuedAt ?? null });
      const invoice = await prisma.clientInvoice.findUnique({ where: { id: params.id } });
      return NextResponse.json({ ok: true, invoice, monthly: r });
    }
    const invoice = await issueInvoice(params.id, { number: body.number, issuedAt, actor: access.email });
    return NextResponse.json({ ok: true, invoice });
  } catch (err: any) {
    const status = err instanceof CreditError ? err.status : 400;
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo emitir." }, { status });
  }
}
