import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/stripe";
import { updateOrderPayment } from "@/lib/orders";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { assignDefaultFrenchEtaIfNeeded, transitionWorkflowState } from "@/lib/workflow-server";

export async function handleStripeOrderWebhook(req: Request, source = "stripe_webhook") {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: any;
  try {
    const body = await req.text();
    event = verifyWebhookSignature(body, signature);
  } catch (err: any) {
    console.error(`[${source}] signature verification failed`, err?.message);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: true });
  }

  const session = event.data.object as any;
  const orderSessionId = String(session?.metadata?.orderSessionId || "").trim();
  const reference = String(session?.metadata?.orderReference || "").trim();

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
      return NextResponse.json({ error: "Order session update failed." }, { status: 500 });
    }
  }

  if (!reference) {
    return NextResponse.json({ received: true });
  }

  try {
    const paymentUpdate = await updateOrderPayment(reference, "STRIPE", String(session.id || ""));
    if (!paymentUpdate.changed) {
      return NextResponse.json({ received: true, duplicate: true });
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

    const order = await prisma.order.findUnique({
      where: { reference },
      select: {
        clientEmail: true,
        title: true,
        amountCents: true,
      },
    });

    if (order?.clientEmail) {
      sendPaymentConfirmedEmail({
        toEmail: order.clientEmail,
        reference,
        title: order.title,
        amountCents: order.amountCents,
        method: "STRIPE",
      }).catch((err) => console.error(`[${source}] payment confirmation email failed`, err));
    }
  } catch (err) {
    console.error(`[${source}] error processing payment`, err);
    return NextResponse.json({ error: "Processing error." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
