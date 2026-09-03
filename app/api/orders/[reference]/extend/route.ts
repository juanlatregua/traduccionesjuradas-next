// app/api/orders/[reference]/extend/route.ts — STAFF: prepara la AMPLIACIÓN de un
// pedido (documentos llegados tras el pago → lote para un presupuesto hermano)
// y devuelve el enlace al constructor. No toca el pedido cobrado.

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { prepareOrderExtension } from "@/lib/order-extend";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { reference: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  try {
    const r = await prepareOrderExtension({ reference: params.reference, actorEmail: access.email });
    return NextResponse.json({ ok: true, ...r });
  } catch (err: any) {
    console.error("[orders:extend] error", err?.message || err);
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo preparar la ampliación." }, { status: 400 });
  }
}
