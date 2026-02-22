import { NextResponse } from "next/server";
import { capturePayPalOrder } from "@/lib/paypal";
import { getOrderDetail, getOrderPublic, updateOrderPayment } from "@/lib/orders";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { assignDefaultFrenchEtaIfNeeded, transitionWorkflowState } from "@/lib/workflow-server";
import { getWorkflowState } from "@/lib/workflow";

export const runtime = "nodejs";

type CaptureBody = {
  paypalOrderId?: string;
  reference?: string;
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `paypal:capture:${ip}`,
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
    const body = (await req.json()) as CaptureBody;

    if (!body.paypalOrderId || !body.reference) {
      return NextResponse.json(
        { ok: false, error: "paypalOrderId y reference requeridos." },
        { status: 400 }
      );
    }

    const order = await getOrderPublic(body.reference);
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

    const captured = await capturePayPalOrder(body.paypalOrderId);

    if (captured.status === "COMPLETED") {
      const paypalReference = captured.purchase_units?.[0]?.reference_id;
      if (paypalReference && paypalReference !== body.reference) {
        return NextResponse.json({ ok: false, error: "Referencia de PayPal no valida." }, { status: 400 });
      }

      const captureId =
        captured.purchase_units?.[0]?.payments?.captures?.[0]?.id || body.paypalOrderId;

      const paymentUpdate = await updateOrderPayment(body.reference, "PAYPAL", captureId);
      if (!paymentUpdate.changed) {
        return NextResponse.json({ ok: true, status: "COMPLETED", alreadyPaid: true });
      }

      await transitionWorkflowState({
        reference: body.reference,
        to: "PAGO_VALIDADO",
        actorEmail: "paypal_capture",
        reason: "Pago capturado por PayPal.",
      }).catch((err) => console.error("[paypal-capture] workflow transition failed", err));
      await assignDefaultFrenchEtaIfNeeded({
        reference: body.reference,
        actorEmail: "paypal_capture",
      }).catch((err) => console.error("[paypal-capture] default FR ETA assignment failed", err));

      // Notify client (non-blocking)
      const fullOrder = await getOrderDetail(body.reference);
      const toEmail = fullOrder?.clientEmail;
      const title = fullOrder?.title || order.title;
      const amountCents = fullOrder?.amountCents || order.amountCents;

      if (toEmail) {
      sendPaymentConfirmedEmail({
        toEmail,
        reference: order.reference,
        title,
        amountCents,
        method: "PAYPAL",
      }).catch((e) => console.error("[paypal-capture] email failed", e));
      }

      return NextResponse.json({ ok: true, status: "COMPLETED" });
    }

    return NextResponse.json({ ok: false, error: `Estado PayPal: ${captured.status}` }, { status: 400 });
  } catch (err: any) {
    console.error("[paypal-capture] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al capturar pago PayPal." },
      { status: 500 }
    );
  }
}
