import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { decimalToNumber, isQuotePayableStatus, moneyToCents, normalizeQuoteStatus } from "@/lib/quotes";
import { createQuoteStripeCheckoutSession } from "@/lib/quote-stripe";

export const runtime = "nodejs";

type Params = {
  params: {
    token: string;
  };
};

export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `quote-checkout:${params.token}:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos de pago. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const quote = await prisma.quote.findUnique({
      where: { publicToken: params.token },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        validUntil: true,
        total: true,
        customerEmail: true,
        deliveryType: true,
      },
    });
    if (!quote) {
      return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
    }

    if (quote.validUntil < new Date()) {
      await prisma.quote.update({
        where: { id: quote.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json({ ok: false, error: "Este presupuesto ha expirado." }, { status: 400 });
    }

    const status = normalizeQuoteStatus(quote.status);
    if (status === "PAID") {
      return NextResponse.json({ ok: false, error: "Este presupuesto ya está pagado." }, { status: 400 });
    }
    if (!isQuotePayableStatus(status)) {
      return NextResponse.json(
        { ok: false, error: `No se puede pagar en estado ${status}.` },
        { status: 400 }
      );
    }

    const totalCents = moneyToCents(decimalToNumber(quote.total));
    if (totalCents < 50) {
      return NextResponse.json({ ok: false, error: "Importe inválido para pago." }, { status: 400 });
    }

    const session = await createQuoteStripeCheckoutSession({
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      quoteToken: params.token,
      totalCents,
      customerEmail: quote.customerEmail,
      deliveryType: quote.deliveryType,
    });

    if (status === "SENT" || status === "OPENED") {
      await prisma.quote.update({
        where: { id: quote.id },
        data: {
          status: "ACCEPTED",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("[quotes:public-checkout] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo iniciar el pago." },
      { status: 500 }
    );
  }
}
