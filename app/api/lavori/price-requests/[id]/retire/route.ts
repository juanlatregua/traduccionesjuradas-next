// STAFF: retira en lavori el encargo de una solicitud viva (SENT, PRICED, ACCEPTED o
// ESCALATED, tenga o no presupuesto) y la cierra en tj.net como RETIRED. Si alguien
// ya la tiene en lavori, 409 con quién — no se toca nada (Juan, 24-sep-2026).
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { retireLeadRequest } from "@/lib/lavori-retire";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const motivo = String(body?.motivo || "").trim();
  if (motivo.length < 3) return NextResponse.json({ ok: false, error: "Falta el motivo (mínimo 3 caracteres)." }, { status: 400 });
  const r = await retireLeadRequest({ id: params.id, actorEmail: access.email, motivo, terminal: "RETIRED", lavoriMotivo: body?.duplicado ? "duplicado" : "reasignado" });
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, ref: r.ref, retiradoEnLavori: r.retiradoEnLavori });
}
