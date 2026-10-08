import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

// Marca (o desmarca) un archivo del traductor como revisado por el staff.
export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const url = String(body?.url || "").trim();
  if (!/^https?:\/\//.test(url) || url.length > 2000) {
    return NextResponse.json({ ok: false, error: "URL no válida." }, { status: 400 });
  }
  const reviewed = body?.reviewed !== false;

  const order = await prisma.order.findUnique({ where: { reference: params.reference }, select: { id: true } });
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "delivery.file_reviewed",
      message: reviewed ? "Archivo del traductor marcado como revisado." : "Archivo del traductor devuelto a sin revisar.",
      payload: { url, reviewed, actorEmail: staff.email },
    },
  });
  return NextResponse.json({ ok: true });
}
