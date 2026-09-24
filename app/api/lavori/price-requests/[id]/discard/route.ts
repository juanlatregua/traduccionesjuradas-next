// app/api/lavori/price-requests/[id]/discard/route.ts — STAFF: descarta una
// solicitud de precio de lavori sin presupuesto (SENT o PRICED, quoteId null)
// desde la carpeta de presupuestos. Cierra el carril en tj.net con motivo,
// quién y cuándo en `notas`, y retira el encargo en lavori (/api/motor/retirada, 24-sep).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { isDiscardableLeadStatus } from "@/lib/lavori-directo-math";
import { retireLeadRequest } from "@/lib/lavori-retire";

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

  // Descartar RETIRA antes el encargo en lavori (24-sep-2026): si alguien ya lo
  // tiene allí, no se descarta; si lavori no responde, tampoco (no consta retirado).
  const r = await retireLeadRequest({
    id: params.id,
    actorEmail: access.email,
    motivo,
    terminal: "DISCARDED",
    lavoriMotivo: "otro",
    allowedStatuses: ["SENT", "PRICED"],
    requireNoQuote: true,
  });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, ref: r.ref, retiradoEnLavori: r.retiradoEnLavori });
}
