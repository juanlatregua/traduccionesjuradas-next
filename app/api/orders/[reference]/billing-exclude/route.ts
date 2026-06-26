// app/api/orders/[reference]/billing-exclude/route.ts
//
// Excluir / devolver un pedido del listado de facturación oficial, con motivo
// (pago no confirmado en banco, prueba, reembolso, duplicado). Reversible y
// auditado vía OrderEvent. No borra nada: solo lo aparta del libro.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: { id: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const b = await req.json().catch(() => ({}));
    const excluded = b?.excluded !== false; // por defecto excluir
    const reason = String(b?.reason || "").trim() || null;
    if (excluded && !reason) {
      return NextResponse.json({ ok: false, error: "Indica un motivo de exclusión." }, { status: 400 });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { billingExcluded: excluded, billingExcludedReason: excluded ? reason : null },
    });

    await prisma.orderEvent
      .create({
        data: {
          orderId: order.id,
          type: excluded ? "billing.excluded" : "billing.reincluded",
          message: excluded ? `Excluido de facturación: ${reason}` : "Devuelto a facturación.",
          payload: { reason, actorEmail: staff.email },
        },
      })
      .catch((e) => console.error("[billing-exclude] event", e));

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[billing-exclude] error", err);
    return NextResponse.json({ ok: false, error: err?.message || "Error." }, { status: 500 });
  }
}
