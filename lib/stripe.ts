import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export function getStripe() {
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY no configurada.");
  }
  if (!/^sk_(test|live)_[^\s]{12,}$/.test(String(stripeSecretKey).trim())) {
    throw new Error("STRIPE_SECRET_KEY no valida.");
  }
  return new Stripe(stripeSecretKey);
}

export async function createCheckoutSession(params: {
  reference: string;
  amountCents: number;
  title: string;
  customerEmail?: string;
  idempotencyKey?: string;
}) {
  const stripe = getStripe();
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net";

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: params.customerEmail,
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: params.amountCents,
            product_data: {
              name: `Traducción jurada: ${params.title}`,
              description: `Referencia: ${params.reference}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        orderReference: params.reference,
      },
      success_url: `${baseUrl}/pago/exito?ref=${params.reference}`,
      cancel_url: `${baseUrl}/area-cliente/pedido/${params.reference}/pagar`,
    },
    params.idempotencyKey
      ? {
          idempotencyKey: params.idempotencyKey,
        }
      : undefined
  );

  return session;
}

export function verifyWebhookSignature(payload: string | Buffer, signature: string) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET no configurada.");
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
