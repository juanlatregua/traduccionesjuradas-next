import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

function getQuoteWebhookSecret() {
  return process.env.STRIPE_QUOTES_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || "";
}

export function verifyQuoteStripeWebhookSignature(payload: string | Buffer, signature: string) {
  const secret = getQuoteWebhookSecret();
  if (!secret) throw new Error("STRIPE_QUOTES_WEBHOOK_SECRET no configurado.");
  const stripe = getStripe();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

export async function createQuoteStripeCheckoutSession(params: {
  quoteId: string;
  quoteNumber: string;
  quoteToken: string;
  totalCents: number;
  customerEmail: string;
  deliveryType: "DIGITAL_PDF" | "PAPER_SHIP";
}) {
  const stripe = getStripe();
  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  const quoteUrl = `${baseUrl}/q/${params.quoteToken}`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: params.customerEmail || undefined,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: params.totalCents,
          product_data: {
            name: `Presupuesto ${params.quoteNumber}`,
            description:
              params.deliveryType === "PAPER_SHIP"
                ? "Traducción jurada con envío en papel"
                : "Traducción jurada en PDF digital",
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      quoteId: params.quoteId,
      quoteNumber: params.quoteNumber,
      quoteToken: params.quoteToken,
      deliveryType: params.deliveryType,
    },
    success_url: `${quoteUrl}?paid=1`,
    cancel_url: `${quoteUrl}?canceled=1`,
  });

  return session;
}

export function getStripeIntentIdFromEvent(event: Stripe.Event) {
  if (event.type === "checkout.session.completed") {
    const obj = event.data.object as Stripe.Checkout.Session;
    const id = obj.payment_intent;
    return typeof id === "string" ? id : id?.id || null;
  }
  if (event.type === "payment_intent.succeeded") {
    const obj = event.data.object as Stripe.PaymentIntent;
    return obj.id || null;
  }
  return null;
}
