import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getSessionIdFromRequest } from "@/lib/session";
import { isStripeConfigured } from "@/lib/payment-config";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Sesion no encontrada." }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Pago con tarjeta no disponible en este entorno." },
      { status: 503 }
    );
  }

  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `payment-intent:${sessionId}:${ip}`,
    limit: 25,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos de pago. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const session = await prisma.orderSession.findUnique({
      where: { id: sessionId },
      include: { docs: true },
    });
    if (!session) {
      return NextResponse.json({ ok: false, error: "Sesion no encontrada." }, { status: 404 });
    }
    if (session.step !== "CHECKOUT") {
      return NextResponse.json(
        { ok: false, error: "La sesion no esta en paso de checkout." },
        { status: 400 }
      );
    }
    if (session.docs.length < 1) {
      return NextResponse.json(
        { ok: false, error: "Debes subir al menos un documento antes de pagar." },
        { status: 400 }
      );
    }
    if (session.totalCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Importe no valido para checkout." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net";
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: session.totalCents,
            product_data: {
              name: "Traduccion jurada",
              description: `Referencia ${session.reference}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        orderSessionId: session.id,
        orderSessionReference: session.reference,
      },
      success_url: `${baseUrl}/confirmation?paid=1`,
      cancel_url: `${baseUrl}/checkout`,
    });

    await prisma.orderSession.update({
      where: { id: session.id },
      data: {
        step: "CHECKOUT",
      },
    });

    return NextResponse.json({ ok: true, url: checkout.url });
  } catch (err: any) {
    console.error("[payment/create-intent] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo crear el pago con tarjeta." },
      { status: 500 }
    );
  }
}
