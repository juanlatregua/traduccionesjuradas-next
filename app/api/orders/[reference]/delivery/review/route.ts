import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { translatorFileUrls } from "@/lib/delivery-files";

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

  const order = await prisma.order.findUnique({
    where: { reference: params.reference },
    select: {
      id: true,
      deliveryFilesJson: true,
      finalDeliveryFileUrl: true,
      translatedFileUrl: true,
      events: { where: { type: "lavori.entrega_subida" }, select: { type: true, payload: true } },
      collaboratorAssignments: { select: { deliveredFileUrl: true } },
    },
  });
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });

  const allowed = translatorFileUrls(order.events, order.collaboratorAssignments.map((a) => a.deliveredFileUrl));
  for (const f of Array.isArray(order.deliveryFilesJson) ? (order.deliveryFilesJson as any[]) : []) {
    if (f?.url) allowed.add(String(f.url));
  }
  if (order.finalDeliveryFileUrl) allowed.add(order.finalDeliveryFileUrl);
  if (order.translatedFileUrl) allowed.add(order.translatedFileUrl);
  if (!allowed.has(url)) {
    return NextResponse.json({ ok: false, error: "Ese archivo no pertenece a este pedido." }, { status: 400 });
  }

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
