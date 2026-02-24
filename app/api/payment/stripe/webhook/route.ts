import { handleStripeOrderWebhook } from "@/lib/payment-stripe-webhook";

export const runtime = "nodejs";

/* POST /api/payment/stripe/webhook — Stripe webhook handler */
export async function POST(req: Request) {
  return handleStripeOrderWebhook(req, "stripe_webhook");
}
