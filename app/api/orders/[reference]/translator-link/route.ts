import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { ensureTranslatorUploadToken } from "@/lib/translator-delivery";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

// Staff: obtiene (creándolo si hace falta) el enlace de subida para el traductor
// asignado. Juan se lo pasa al traductor para que suba su traducción terminada.
export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  const token = await ensureTranslatorUploadToken(params.reference);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, token, path: `/entrega/${token}` });
}
