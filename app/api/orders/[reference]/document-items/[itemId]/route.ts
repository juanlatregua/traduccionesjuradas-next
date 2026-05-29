// app/api/orders/[reference]/document-items/[itemId]/route.ts
// STAFF: actualiza el estado de producción o el colaborador de un documento del
// expediente (OrderDocumentItem). Usado por el cockpit de proyecto.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

const STATUSES = ["PENDING", "IN_TRANSLATION", "DELIVERED"];

type Params = { params: { reference: string; itemId: string } };

export async function PATCH(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }

  const order = await prisma.order.findUnique({ where: { reference: params.reference }, select: { id: true } });
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });

  const item = await prisma.orderDocumentItem.findUnique({ where: { id: params.itemId }, select: { id: true, orderId: true } });
  if (!item || item.orderId !== order.id) {
    return NextResponse.json({ ok: false, error: "Documento no encontrado." }, { status: 404 });
  }

  const data: Record<string, any> = {};
  if (typeof body.prodStatus === "string" && STATUSES.includes(body.prodStatus)) {
    data.prodStatus = body.prodStatus;
    data.deliveredAt = body.prodStatus === "DELIVERED" ? new Date() : null;
  }
  if (typeof body.assignedTo === "string") {
    data.assignedTo = body.assignedTo.trim() || null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "Nada que actualizar." }, { status: 400 });
  }

  const updated = await prisma.orderDocumentItem.update({ where: { id: item.id }, data });
  return NextResponse.json({ ok: true, item: updated });
}
