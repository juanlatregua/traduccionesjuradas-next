import { handleStripeOrderWebhook } from "@/lib/payment-stripe-webhook";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const response = await handleStripeOrderWebhook(req, "payment_webhook_legacy");
  response.headers.set("x-webhook-alias", "deprecated:/api/payment/stripe/webhook");
  return response;
}
