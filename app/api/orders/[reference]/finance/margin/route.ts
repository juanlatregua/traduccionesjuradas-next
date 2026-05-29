import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type Body = {
  supplierCostCents?: number;
  gatewayFeeCents?: number;
  otherCostCents?: number;
  notes?: string;
};

function toCents(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        amountCents: true,
        collaboratorAssignments: {
          where: { status: { in: ["ACCEPTED", "DELIVERED"] } },
          select: { quotedPriceCents: true },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    // Coste de proveedor detectado automáticamente: suma de lo presupuestado por
    // los colaboradores aceptados/entregados. Valor por defecto si el staff no
    // introduce uno a mano (antes había que reescribirlo cada vez).
    const autoSupplierCostCents = order.collaboratorAssignments.reduce(
      (sum, a) => sum + (a.quotedPriceCents || 0),
      0
    );

    const body = (await req.json()) as Body;
    const revenueCents = order.amountCents;
    const supplierCostCents =
      body.supplierCostCents != null ? toCents(body.supplierCostCents) : autoSupplierCostCents;
    const gatewayFeeCents = toCents(body.gatewayFeeCents);
    const otherCostCents = toCents(body.otherCostCents);
    const marginCents = revenueCents - supplierCostCents - gatewayFeeCents - otherCostCents;
    const marginPct = revenueCents > 0 ? Number(((marginCents / revenueCents) * 100).toFixed(2)) : null;

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "finance.margin.snapshot",
        message: `Margen actualizado: ${(marginCents / 100).toFixed(2)} EUR (${marginPct ?? 0}%).`,
        payload: {
          revenueCents,
          supplierCostCents,
          autoSupplierCostCents,
          supplierCostSource: body.supplierCostCents != null ? "manual" : "auto",
          gatewayFeeCents,
          otherCostCents,
          marginCents,
          marginPct,
          notes: body.notes || null,
          actorEmail,
        },
      },
    });

    return NextResponse.json({ ok: true, marginCents, marginPct, supplierCostCents, autoSupplierCostCents });
  } catch (err: any) {
    console.error("[finance-margin] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error actualizando margen." },
      { status: 500 }
    );
  }
}
