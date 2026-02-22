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
    const rl = checkRateLimit({
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
    const { events: _events, ...safeOrder } = order;
    return NextResponse.json({ ok: true, order: { ...safeOrder, workflowState } });
  } catch (err) {
    console.error("[orders/public] error fetching order", err);
    return NextResponse.json({ ok: false, error: "Error al consultar pedido." }, { status: 500 });
  }
}
