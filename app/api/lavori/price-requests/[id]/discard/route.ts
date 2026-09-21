// app/api/lavori/price-requests/[id]/discard/route.ts — STAFF: descarta una
// solicitud de precio de lavori sin presupuesto (SENT o PRICED, quoteId null)
// desde la carpeta de presupuestos. Cierra el carril en tj.net con motivo,
// quién y cuándo en `notas`; el encargo en lavori lo retira Juan a mano — este
// endpoint no avisa a nadie ni llama a lavori (Juan, 21-sep-2026).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { isDiscardableLeadStatus } from "@/lib/lavori-directo-math";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: { motivo?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  const motivo = String(body.motivo || "").trim();
  if (motivo.length < 3) {
    return NextResponse.json({ ok: false, error: "Falta el motivo (mínimo 3 caracteres)." }, { status: 400 });
  }

  const current = await prisma.lavoriPriceRequest.findUnique({
    where: { id: params.id },
    select: { notas: true, status: true, quoteId: true, ref: true },
  });
  if (!current) return NextResponse.json({ ok: false, error: "Solicitud no encontrada." }, { status: 404 });
  if (current.quoteId) {
    return NextResponse.json({ ok: false, error: "Ya tiene presupuesto atado: no se puede descartar." }, { status: 409 });
  }
  if (!isDiscardableLeadStatus(current.status)) {
    return NextResponse.json(
      { ok: false, error: `Ya está en estado ${current.status}: no se puede descartar.` },
      { status: 409 }
    );
  }

  const sello = `Descartada por ${access.email} el ${new Date().toISOString()}: ${motivo}`;
  const notas = [current.notas, sello].filter(Boolean).join("\n");

  // Claim atómico: si en el ínterin llegó un presupuesto o cambió de estado
  // (p.ej. un precio_propuesto que la movió de SENT a PRICED), el WHERE no
  // encuentra fila y no se descarta nada por sorpresa.
  const claim = await prisma.lavoriPriceRequest.updateMany({
    where: { id: params.id, quoteId: null, status: { in: ["SENT", "PRICED"] } },
    data: { status: "DISCARDED", notas },
  });
  if (claim.count === 0) {
    return NextResponse.json(
      { ok: false, error: "Ya no se puede descartar: tiene presupuesto o cambió de estado mientras tanto." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, ref: current.ref });
}
