import { NextResponse } from "next/server";
import { capturePayPalOrder } from "@/lib/paypal";
import { getOrderDetail, getOrderPublic, updateOrderPayment } from "@/lib/orders";
import { sendPaymentConfirmedEmail, sendNewOrderStaffEmail } from "@/lib/email";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { assignDefaultFrenchEtaIfNeeded, autoAssignCollaboratorIfNeeded, transitionWorkflowState } from "@/lib/workflow-server";
import { getWorkflowState } from "@/lib/workflow";
import { isPayPalConfigured } from "@/lib/payment-config";
import { hasUploadedSourceDocument, MISSING_SOURCE_DOCUMENT_ERROR } from "@/lib/payment-gating";

export const runtime = "nodejs";

type CaptureBody = {
  paypalOrderId?: string;
  reference?: string;
};

export async function POST(req: Request) {
  if (!isPayPalConfigured()) {
    return NextResponse.json(
      { ok: false, error: "PayPal no esta disponible en este entorno." },
      { status: 503 }
    );
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit({
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
    if (!hasUploadedSourceDocument(order)) {
      return NextResponse.json({ ok: false, error: MISSING_SOURCE_DOCUMENT_ERROR }, { status: 400 });
    }

    const captured = await capturePayPalOrder(
      body.paypalOrderId,
      `order:${body.reference}:paypal:capture`
    );

    if (captured.status === "COMPLETED") {
      const paypalReference = captured.purchase_units?.[0]?.reference_id;
      if (paypalReference && paypalReference !== body.reference) {
        return NextResponse.json({ ok: false, error: "Referencia de PayPal no valida." }, { status: 400 });
      }

      const captureId =
        captured.purchase_units?.[0]?.payments?.captures?.[0]?.id || body.paypalOrderId;

      const paymentUpdate = await updateOrderPayment(body.reference, "PAYPAL", captureId, {
        source: "paypal_capture",
        payload: {
          paypalOrderId: body.paypalOrderId,
          captureId,
          capturedStatus: captured.status,
        },
      });
      if (!paymentUpdate.changed) {
        return NextResponse.json({
          ok: true,
          status: "COMPLETED",
          alreadyPaid: true,
          duplicate: paymentUpdate.duplicate,
        });
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

      await autoAssignCollaboratorIfNeeded({
        reference: body.reference,
        actorEmail: "paypal_capture",
      }).catch((err) => console.error("[paypal-capture] auto collaborator assignment failed", err));

      // Notify client (non-blocking)
      const fullOrder = await getOrderDetail(body.reference);
      const toEmail = fullOrder?.clientEmail;
      const title = fullOrder?.title || order.title;
      const amountCents = fullOrder?.amountCents || order.amountCents;

      // Aviso a staff — toda vía de pago debe avisar (antes PayPal no lo hacía).
      sendEmailWithRetry(() =>
        sendNewOrderStaffEmail({
          reference: order.reference,
          title,
          amountCents,
          clientEmail: toEmail || "",
          langPair: fullOrder?.langPair || undefined,
        })
      ).catch((e) => console.error("[paypal-capture] staff new-order email failed", e));

      if (toEmail) {
        sendEmailWithRetry(() =>
          sendPaymentConfirmedEmail({
            toEmail,
            reference: order.reference,
            title,
            amountCents,
            method: "PAYPAL",
            lang: fullOrder?.clientLocale === "fr" ? "fr" : "es",
          })
        ).catch((e) => console.error("[paypal-capture] email failed", e));
      }

      // SMS de hito "pago confirmado" (fire & forget) — igual que Stripe/Redsys.
      if (fullOrder) {
        const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
        const { smsPagoConfirmado, formatDeliveryPlazo } = await import("@/lib/sms-templates");
        const { buildSignedOrderUrl } = await import("@/lib/order-token");
        const phone = await getOrderPhone(fullOrder.id).catch(() => null);
        if (phone) {
          const lang = fullOrder.clientLocale === "fr" ? "fr" : "es";
          sendNotification({
            to: formatPhoneSpain(phone),
            body: smsPagoConfirmado({
              ref: order.reference,
              plazo: formatDeliveryPlazo(fullOrder.dueDate, lang),
              url: buildSignedOrderUrl(order.reference, "estado"),
              lang,
            }),
          }).catch((err) => console.error("[paypal-capture] SMS failed", err));
        }
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
