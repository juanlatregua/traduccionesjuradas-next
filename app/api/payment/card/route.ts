import { NextResponse } from "next/server";
import { getOrderPublic } from "@/lib/orders";
import { createCheckoutSession } from "@/lib/stripe";
import { buildRedsysFormData } from "@/lib/redsys";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Body = { reference?: string };

function getCardProvider() {
  const provider = (process.env.CARD_PROVIDER || "stripe").trim().toLowerCase();
  return provider === "redsys" ? "redsys" : "stripe";
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `payment:card:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos de pago. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await req.json()) as Body;
    const reference = String(body.reference || "").trim();
    if (!reference) {
      return NextResponse.json({ ok: false, error: "Referencia requerida." }, { status: 400 });
    }

    const order = await getOrderPublic(reference);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }
    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ ok: false, error: "Este pedido ya esta pagado." }, { status: 400 });
    }

    const provider = getCardProvider();

    if (provider === "stripe") {
      const session = await createCheckoutSession({
        reference: order.reference,
        amountCents: order.amountCents,
        title: order.title,
      });
      return NextResponse.json({ ok: true, kind: "redirect", provider, url: session.url });
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      new URL(req.url).origin;
    const formData = buildRedsysFormData({
      orderReference: reference,
      amountCents: order.amountCents,
      notificationUrl: `${origin}/api/payment/redsys/notification`,
      successUrl: `${origin}/pago/exito?ref=${encodeURIComponent(reference)}`,
      cancelUrl: `${origin}/pago/cancelado?ref=${encodeURIComponent(reference)}`,
    });

    return NextResponse.json({ ok: true, kind: "redsys_form", provider, ...formData });
  } catch (err: any) {
    console.error("[payment/card] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al iniciar pago con tarjeta." },
      { status: 500 }
    );
  }
}
