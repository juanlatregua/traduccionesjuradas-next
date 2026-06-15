import Stripe from "stripe";
import { buildSignedOrderUrl } from "@/lib/order-token";

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
  locale?: string | null;
}) {
  const stripe = getStripe();
  const baseUrl = process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net";

  // La pasarela hereda el idioma del pedido. Solo soportamos es/fr en producto;
  // el resto cae a español (mercado por defecto).
  const fr = params.locale === "fr";
  const productName = fr
    ? `Traduction assermentée : ${params.title}`
    : `Traducción jurada: ${params.title}`;
  const productDescription = fr
    ? `Référence : ${params.reference}`
    : `Referencia: ${params.reference}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      locale: fr ? "fr" : "es",
      customer_email: params.customerEmail,
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: params.amountCents,
            product_data: {
              name: productName,
              description: productDescription,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        orderReference: params.reference,
      },
      success_url: `${baseUrl}/pago/exito?ref=${params.reference}`,
      cancel_url: buildSignedOrderUrl(params.reference, "pagar"),
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
