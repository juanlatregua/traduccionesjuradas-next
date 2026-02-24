import { NextResponse } from "next/server";
import { getOrderPublic } from "@/lib/orders";
import { buildRedsysFormData } from "@/lib/redsys";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getWorkflowState } from "@/lib/workflow";
import { hasUploadedSourceDocument, MISSING_SOURCE_DOCUMENT_ERROR } from "@/lib/payment-gating";

export const runtime = "nodejs";

type RedsysBody = {
  reference?: string;
};

/* POST /api/payment/redsys — no auth required (guests can pay) */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `redsys:create:${ip}`,
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
    const body = (await req.json()) as RedsysBody;
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
    if (!hasUploadedSourceDocument(order)) {
      return NextResponse.json({ ok: false, error: MISSING_SOURCE_DOCUMENT_ERROR }, { status: 400 });
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      new URL(req.url).origin;

    const formData = buildRedsysFormData({
      orderReference: reference,
      amountCents: order.amountCents,
      notificationUrl: `${origin}/api/payment/redsys/notification`,
      successUrl: `${origin}/pago/exito?ref=${encodeURIComponent(reference)}`,
      cancelUrl: `${origin}/pago/cancelado?ref=${encodeURIComponent(reference)}`,
    });

    return NextResponse.json({ ok: true, ...formData });
  } catch (err: any) {
    console.error("[redsys] error creating form", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al generar formulario de pago." },
      { status: 500 }
    );
  }
}
