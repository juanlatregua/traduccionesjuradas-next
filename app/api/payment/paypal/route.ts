import { NextResponse } from "next/server";
import { getOrderPublic } from "@/lib/orders";
import { createPayPalOrder } from "@/lib/paypal";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getWorkflowState } from "@/lib/workflow";

export const runtime = "nodejs";

type PayPalBody = {
  reference?: string;
};

/* POST /api/payment/paypal — no auth required (guests can pay) */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `paypal:create:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await req.json()) as PayPalBody;
    const reference = body.reference?.trim();

    if (!reference) {
      return NextResponse.json({ ok: false, error: "Referencia requerida." }, { status: 400 });
    }

    const order = await getOrderPublic(reference);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ ok: false, error: "Este pedido ya esta pagado." }, { status: 400 });
    }
    const workflowState = getWorkflowState(order);
    if (!["PENDIENTE_PAGO", "JUSTIFICANTE_SUBIDO", "PRESUPUESTO_ENVIADO"].includes(workflowState)) {
      return NextResponse.json(
        { ok: false, error: "Este pedido aun no esta habilitado para pago." },
        { status: 400 }
      );
    }

    const amountEur = (order.amountCents / 100).toFixed(2);
    const paypalOrder = await createPayPalOrder({
      orderReference: reference,
      amountEur,
      description: order.title || `Traduccion jurada ${reference}`,
    });

    return NextResponse.json({ ok: true, paypalOrderId: paypalOrder.id });
  } catch (err: any) {
    console.error("[paypal] error creating order", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al crear orden PayPal." },
      { status: 500 }
    );
  }
}
