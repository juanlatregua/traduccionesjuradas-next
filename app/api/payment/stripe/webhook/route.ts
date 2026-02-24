import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/stripe";
import { updateOrderPayment } from "@/lib/orders";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { assignDefaultFrenchEtaIfNeeded, transitionWorkflowState } from "@/lib/workflow-server";

export const runtime = "nodejs";

/* POST /api/payment/stripe/webhook — Stripe webhook handler */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event;
  try {
    const body = await req.text();
    event = verifyWebhookSignature(body, signature);
  } catch (err: any) {
    console.error("[stripe-webhook] signature verification failed", err?.message);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const orderSessionId = String(session.metadata?.orderSessionId || "").trim();
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
        console.error("[stripe-webhook] failed updating order session", err);
      }
      return NextResponse.json({ received: true });
    }

    const reference = session.metadata?.orderReference;
    if (!reference) {
      console.error("[stripe-webhook] no orderReference in metadata");
      return NextResponse.json({ received: true });
    }

    try {
      // Update order payment status
      const paymentUpdate = await updateOrderPayment(reference, "STRIPE", session.id);
      if (!paymentUpdate.changed) {
        return NextResponse.json({ received: true });
      }

      await transitionWorkflowState({
        reference,
        to: "PAGO_VALIDADO",
        actorEmail: "stripe_webhook",
        reason: "Pago validado por webhook Stripe.",
      }).catch((err) => console.error("[stripe-webhook] workflow transition failed", err));
      await assignDefaultFrenchEtaIfNeeded({
        reference,
        actorEmail: "stripe_webhook",
      }).catch((err) => console.error("[stripe-webhook] default FR ETA assignment failed", err));

      // Fetch order to get client email for confirmation
      const order = await prisma.order.findUnique({
        where: { reference },
        select: { clientEmail: true, title: true, amountCents: true },
      });

      if (order?.clientEmail) {
        sendPaymentConfirmedEmail({
          toEmail: order.clientEmail,
          reference,
          title: order.title,
          amountCents: order.amountCents,
          method: "STRIPE",
        }).catch((e) => console.error("[stripe-webhook] email failed", e));
      }
    } catch (err) {
      console.error("[stripe-webhook] error processing payment", err);
      return NextResponse.json({ error: "Processing error." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
