import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MARGIN_APPROVAL_THRESHOLD_PCT } from "@/lib/finance";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };
type ApprovalStatus = "APPROVED" | "REJECTED";

type Body = {
  status?: ApprovalStatus;
  note?: string;
};

function safeStatus(raw: unknown): ApprovalStatus | null {
  const s = String(raw || "").toUpperCase();
  if (s === "APPROVED" || s === "REJECTED") return s;
  return null;
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
      select: { id: true, reference: true, amountCents: true, events: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as Body;
    const status = safeStatus(body.status);
    if (!status) {
      return NextResponse.json(
        { ok: false, error: "status debe ser APPROVED o REJECTED." },
        { status: 400 }
      );
    }

    const latestMarginEvent = order.events.find((e) => e.type === "finance.margin.snapshot");
    const marginPct = Number((latestMarginEvent?.payload as any)?.marginPct);

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "finance.margin.approval.updated",
        message:
          status === "APPROVED"
            ? `Margen bajo aprobado (${MARGIN_APPROVAL_THRESHOLD_PCT}%).`
            : `Margen bajo rechazado (${MARGIN_APPROVAL_THRESHOLD_PCT}%).`,
        payload: {
          status,
          marginPct: Number.isFinite(marginPct) ? marginPct : null,
          thresholdPct: MARGIN_APPROVAL_THRESHOLD_PCT,
          note: body.note || null,
          actorEmail,
        },
      },
    });

    return NextResponse.json({ ok: true, status });
  } catch (err: any) {
    console.error("[finance-margin-approval] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error actualizando aprobacion de margen." },
      { status: 500 }
    );
  }
}
