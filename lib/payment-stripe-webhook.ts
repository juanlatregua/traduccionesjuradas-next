import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/stripe";
import { updateOrderPayment } from "@/lib/orders";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { prisma } from "@/lib/prisma";
import { assignDefaultFrenchEtaIfNeeded, autoAssignCollaboratorIfNeeded, transitionWorkflowState } from "@/lib/workflow-server";

export async function handleStripeOrderWebhook(req: Request, source = "stripe_webhook") {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing signature." }, { status: 400 });
  }

  let event: any;
  try {
    const body = await req.text();
    event = verifyWebhookSignature(body, signature);
  } catch (err: any) {
    console.error(`[${source}] signature verification failed`, err?.message);
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const session = event.data.object as any;
  const orderSessionId = String(session?.metadata?.orderSessionId || "").trim();
  const reference = String(session?.metadata?.orderReference || "").trim();
  const stripeSessionId = String(session?.id || "").trim();
  const stripePaymentIntentId = String(session?.payment_intent || "").trim();

  if (orderSessionId) {
    try {
      await prisma.orderSession.updateMany({
        where: { id: orderSessionId, isPaid: false },
        data: {
          isPaid: true,
          paidAt: new Date(),
          paymentMethod: "stripe",
          step: "CONFIRMATION",
        },
      });
    } catch (err) {
      console.error(`[${source}] failed updating order session`, err);
      return NextResponse.json({ ok: false, error: "Order session update failed." }, { status: 500 });
    }
  }

  if (!reference) {
    return NextResponse.json({ ok: true });
  }

  try {
    const paymentUpdate = await updateOrderPayment(
      reference,
      "STRIPE",
      stripePaymentIntentId || stripeSessionId,
      {
        source,
        payload: {
          stripeEventId: String(event.id || ""),
          stripeSessionId: stripeSessionId || null,
          stripePaymentIntentId: stripePaymentIntentId || null,
        },
      }
    );
    if (!paymentUpdate.changed) {
      return NextResponse.json({ ok: true, duplicate: true, alreadyPaid: paymentUpdate.alreadyPaid });
    }

    await transitionWorkflowState({
      reference,
      to: "PAGO_VALIDADO",
      actorEmail: source,
      reason: "Pago validado por webhook Stripe.",
    }).catch((err) => console.error(`[${source}] workflow transition failed`, err));

    await assignDefaultFrenchEtaIfNeeded({
      reference,
      actorEmail: source,
    }).catch((err) => console.error(`[${source}] default FR ETA assignment failed`, err));

    await autoAssignCollaboratorIfNeeded({
      reference,
      actorEmail: source,
    }).catch((err) => console.error(`[${source}] auto collaborator assignment failed`, err));

    const order = await prisma.order.findUnique({
      where: { reference },
      select: {
        clientEmail: true,
        title: true,
        amountCents: true,
      },
    });

    if (order?.clientEmail) {
      sendEmailWithRetry(() =>
        sendPaymentConfirmedEmail({
          toEmail: order.clientEmail,
          reference,
          title: order.title,
          amountCents: order.amountCents,
          method: "STRIPE",
        })
      ).catch((err) => console.error(`[${source}] payment confirmation email failed`, err));

      // SMS notification (fire & forget)
      const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
      const { smsPagoConfirmado } = await import("@/lib/sms-templates");
      const orderFull = await prisma.order.findUnique({
        where: { reference },
        select: { id: true, dueDate: true },
      });
      if (orderFull) {
        const phone = await getOrderPhone(orderFull.id).catch(() => null);
        if (phone) {
          const plazo = orderFull.dueDate
            ? orderFull.dueDate.toLocaleDateString("es-ES", { day: "numeric", month: "long" })
            : "3-5 días laborables";
          sendNotification({
            to: formatPhoneSpain(phone),
            body: smsPagoConfirmado({ ref: reference, plazo }),
          }).catch((err) => console.error(`[${source}] SMS failed`, err));
        }
      }
    }
  } catch (err) {
    console.error(`[${source}] error processing payment`, err);
    return NextResponse.json({ ok: false, error: "Processing error." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
