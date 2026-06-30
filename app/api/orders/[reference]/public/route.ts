import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getWorkflowState } from "@/lib/workflow";
import { verifyOrderToken } from "@/lib/order-token";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type PublicOrderItem = {
  description: string;
  quantity: number;
  amountCents: number;
};

function normalizeItems(snapshot: unknown): PublicOrderItem[] {
  const value = snapshot as any;
  const lines = Array.isArray(value?.lines) ? value.lines : [];
  return lines
    .map((line: any) => {
      const description = String(line?.documentName || line?.description || "Concepto").trim();
      const quantityRaw = Number(line?.quantity);
      const amountRaw = Number(line?.amountCents);
      return {
        description: description || "Concepto",
        quantity: Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1,
        amountCents: Number.isFinite(amountRaw) && amountRaw >= 0 ? Math.round(amountRaw) : 0,
      };
    })
    .slice(0, 25);
}

/* GET /api/orders/:reference/public — minimal order info without auth (payment page). */
export async function GET(req: Request, { params }: Params) {
  try {
    const ip = getClientIp(req);
    const rl = await checkRateLimit({
      key: `orders:public:${ip}`,
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Demasiadas consultas. Intentalo en unos minutos." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token || !verifyOrderToken(params.reference, token)) {
      return NextResponse.json(
        { ok: false, error: "Enlace no válido o caducado." },
        { status: 401 },
      );
    }

    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        reference: true,
        title: true,
        amountCents: true,
        currency: true,
        paymentStatus: true,
        status: true,
        deliveryState: true,
        clientLocale: true,
        quoteSnapshotJson: true,
        events: {
          where: {
            type: {
              in: ["workflow.state_changed", "order.source_document_uploaded"],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            type: true,
            payload: true,
            createdAt: true,
          },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const workflowState = getWorkflowState({
      paymentStatus: order.paymentStatus,
      deliveryState: order.deliveryState,
      events: order.events,
    });
    const paymentBlocked = workflowState === "BORRADOR" || workflowState === "PENDIENTE_REVISION";
    const hasSourceDocument = order.events.some((event) => event.type === "order.source_document_uploaded");

    const publicOrder = {
      reference: order.reference,
      title: order.title,
      amountCents: order.amountCents,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      status: order.status,
      clientLocale: order.clientLocale,
      paymentBlocked,
      hasSourceDocument,
      items: normalizeItems(order.quoteSnapshotJson),
    };
    return NextResponse.json({ ok: true, order: publicOrder });
  } catch (err) {
    console.error("[orders/public] error fetching order", err);
    return NextResponse.json({ ok: false, error: "Error al consultar pedido." }, { status: 500 });
  }
}
