import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_RECONCILIATION_TOLERANCE_CENTS,
  FINANCE_RECONCILIATION_TOLERANCE_MAX_CENTS,
  FINANCE_RECONCILIATION_TOLERANCE_MIN_CENTS,
} from "@/lib/finance";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type Body = {
  expectedAmountCents?: number;
  receivedAmountCents?: number;
  gatewayFeeCents?: number;
  toleranceCents?: number;
  settledAt?: string;
  notes?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
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
      select: { id: true, reference: true, amountCents: true, paymentStatus: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as Body;
    const expectedAmountCents = Number.isFinite(Number(body.expectedAmountCents))
      ? Math.round(Number(body.expectedAmountCents))
      : order.amountCents;
    const receivedAmountCents = Number.isFinite(Number(body.receivedAmountCents))
      ? Math.round(Number(body.receivedAmountCents))
      : NaN;
    const gatewayFeeCents = Number.isFinite(Number(body.gatewayFeeCents))
      ? Math.max(0, Math.round(Number(body.gatewayFeeCents)))
      : 0;
    const toleranceCentsRaw = Number(body.toleranceCents);
    const toleranceCents = Number.isFinite(toleranceCentsRaw)
      ? clamp(
          Math.round(toleranceCentsRaw),
          FINANCE_RECONCILIATION_TOLERANCE_MIN_CENTS,
          FINANCE_RECONCILIATION_TOLERANCE_MAX_CENTS
        )
      : DEFAULT_RECONCILIATION_TOLERANCE_CENTS;

    if (!Number.isFinite(receivedAmountCents) || receivedAmountCents < 0) {
      return NextResponse.json(
        { ok: false, error: "receivedAmountCents es obligatorio y debe ser válido." },
        { status: 400 }
      );
    }

    const diffCents = receivedAmountCents - expectedAmountCents;
    const status = Math.abs(diffCents) <= toleranceCents ? "MATCHED" : "MISMATCH";
    const netAmountCents = receivedAmountCents - gatewayFeeCents;

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "finance.reconciliation.updated",
        message:
          status === "MATCHED"
            ? "Conciliacion de cobro registrada (OK)."
            : `Conciliacion con descuadre (${(diffCents / 100).toFixed(2)} EUR).`,
        payload: {
          expectedAmountCents,
          receivedAmountCents,
          gatewayFeeCents,
          netAmountCents,
          diffCents,
          toleranceCents,
          status,
          settledAt: body.settledAt || null,
          notes: body.notes || null,
          actorEmail,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      reconciliationStatus: status,
      diffCents,
      toleranceCents,
      netAmountCents,
    });
  } catch (err: any) {
    console.error("[finance-reconciliation] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error actualizando conciliación." },
      { status: 500 }
    );
  }
}
