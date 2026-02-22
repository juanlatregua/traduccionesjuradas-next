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
      select: { id: true, amountCents: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as Body;
    const revenueCents = order.amountCents;
    const supplierCostCents = toCents(body.supplierCostCents);
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
          gatewayFeeCents,
          otherCostCents,
          marginCents,
          marginPct,
          notes: body.notes || null,
          actorEmail,
        },
      },
    });

    return NextResponse.json({ ok: true, marginCents, marginPct });
  } catch (err: any) {
    console.error("[finance-margin] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error actualizando margen." },
      { status: 500 }
    );
  }
}
