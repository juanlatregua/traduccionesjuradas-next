import { NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/stripe";
import { getOrderPublic } from "@/lib/orders";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getWorkflowState } from "@/lib/workflow";
import { isStripeConfigured } from "@/lib/payment-config";

export const runtime = "nodejs";

/* POST /api/payment/stripe — create Stripe Checkout session.
   No auth required (guests can pay with card). */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Stripe no esta disponible en este entorno." },
      { status: 503 }
    );
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `stripe:create:${ip}`,
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
    const body = (await req.json()) as { reference?: string };
    const reference = body.reference?.trim();
    if (!reference) {
      return NextResponse.json({ ok: false, error: "Referencia requerida." }, { status: 400 });
    }

    const order = await getOrderPublic(reference);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }
    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ ok: false, error: "Este pedido ya está pagado." }, { status: 400 });
    }
    const workflowState = getWorkflowState(order);
    if (!["PENDIENTE_PAGO", "JUSTIFICANTE_SUBIDO", "PRESUPUESTO_ENVIADO"].includes(workflowState)) {
      return NextResponse.json(
        { ok: false, error: "Este pedido aun no esta habilitado para pago." },
        { status: 400 }
      );
    }

    const session = await createCheckoutSession({
      reference: order.reference,
      amountCents: order.amountCents,
      title: order.title,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (err: any) {
    console.error("[stripe] error creating checkout session", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al crear sesión de pago." },
      { status: 500 }
    );
  }
}
