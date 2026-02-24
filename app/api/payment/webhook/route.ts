import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing stripe-signature." }, { status: 400 });
  }

  let event: any;
  try {
    const body = await req.text();
    event = verifyWebhookSignature(body, signature);
  } catch (err: any) {
    console.error("[payment/webhook] invalid signature", err?.message);
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const stripeSession = event.data.object as any;
    const orderSessionId = String(stripeSession?.metadata?.orderSessionId || "").trim();
    if (!orderSessionId) {
      return NextResponse.json({ ok: true, ignored: "missing-orderSessionId" });
    }

    try {
      await prisma.orderSession.updateMany({
        where: {
          id: orderSessionId,
          isPaid: false,
        },
        data: {
          isPaid: true,
          paidAt: new Date(),
          paymentMethod: "stripe",
          step: "CONFIRMATION",
        },
      });
    } catch (err) {
      console.error("[payment/webhook] failed updating order session", err);
      return NextResponse.json({ ok: false, error: "Update failed." }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

