import { NextResponse } from "next/server";
import { getOrderPublic } from "@/lib/orders";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getWorkflowState } from "@/lib/workflow";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

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

    const order = await getOrderPublic(params.reference);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }
    const workflowState = getWorkflowState(order);
    const sourceDocuments = (order.events || [])
      .filter((event) => event.type === "order.source_document_uploaded")
      .map((event) => {
        const payload = (event.payload || {}) as any;
        return {
          fileUrl: String(payload.fileUrl || "").trim(),
          fileName: String(payload.fileName || "Documento").trim(),
          fileType: payload.fileType ? String(payload.fileType) : undefined,
          uploadedAt: payload.uploadedAt ? String(payload.uploadedAt) : event.createdAt,
        };
      })
      .filter((doc) => !!doc.fileUrl);
    const publicOrder = {
      reference: order.reference,
      title: order.title,
      amountCents: order.amountCents,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
      status: order.status,
      langPair: order.langPair,
      deliveryState: order.deliveryState,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      dueDate: order.dueDate,
      workflowState,
      sourceDocuments,
    };
    return NextResponse.json({ ok: true, order: publicOrder });
  } catch (err) {
    console.error("[orders/public] error fetching order", err);
    return NextResponse.json({ ok: false, error: "Error al consultar pedido." }, { status: 500 });
  }
}
