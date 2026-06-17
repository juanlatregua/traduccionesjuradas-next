import { NextResponse } from "next/server";
import { verifyQuoteStripeWebhookSignature } from "@/lib/quote-stripe";
import { processQuoteStripeEvent } from "@/lib/quote-stripe-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    const body = await req.text();
    event = verifyQuoteStripeWebhookSignature(body, signature);
  } catch (err: any) {
    console.error("[quotes:webhook] invalid signature", err?.message || err);
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  return processQuoteStripeEvent(event);
}
