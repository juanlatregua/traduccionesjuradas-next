// app/api/quotes/public/[token]/declare-transfer/route.ts — botón "Ya he
// transferido" de la página pública del presupuesto (/q/[token]).
//
// El problema que resuelve (Juan, 19-sep-2026): la pestaña Transferencia daba
// IBAN y concepto y ahí se acababa. El cliente transfería y no tenía dónde
// dejar el justificante, así que llegaba por donde podía o no llegaba. La
// pantalla de subida YA existía, pero cuelga de un PEDIDO y en fase de
// presupuesto todavía no hay pedido: este endpoint es el puente que faltaba.
//
// Crea la cáscara del pedido SIN cobro (idempotente por quoteId: el doble clic
// no duplica, y si luego paga con tarjeta el webhook reutiliza este mismo
// pedido) y devuelve la URL firmada de la pantalla de pago, que es la que lleva
// el formulario de subida.
//
// Lo que NO hace, a propósito:
//   · NO marca pagado ni crea QuotePayment. Una transferencia no es automática:
//     el justificante es una afirmación del cliente y lo valida el staff a mano
//     (POST /api/orders/[reference]/payment-proof ya lo deja en
//     JUSTIFICANTE_SUBIDO sin tocar el cobro).
//   · NO toca el estado del Quote. El checkout de tarjeta sí lo pasa a ACCEPTED,
//     pero aquí no: un clic no es una aceptación cobrada, y ACCEPTED lo lee el
//     emparejamiento PRICED+ACCEPTED de lib/lavori-assign.ts. Mismo criterio que
//     el carril de crédito (lib/quote-credit.ts), que tampoco lo toca.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { decimalToNumber, isQuotePayableStatus, normalizeQuoteStatus } from "@/lib/quotes";
import { createOrderShellFromQuote } from "@/lib/orders";
import { buildSignedOrderUrl } from "@/lib/order-token";
import { sendNewOrderStaffEmail } from "@/lib/email";

export const runtime = "nodejs";

type Params = { params: { token: string } };

export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `quote-declare-transfer:${params.token}:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera unos minutos." },
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
        paidAt: true,
        validUntil: true,
        total: true,
        currency: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        sourceLang: true,
        targetLang: true,
        expedienteRef: true,
        deliveryType: true,
        lines: {
          select: { description: true, unitPrice: true, sourceFileUrl: true, pageStart: true, pageEnd: true },
        },
        orders: { select: { reference: true }, take: 1 },
      },
    });
    if (!quote) {
      return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
    }

    // Si ya hay pedido (clic anterior, crédito o pago), su pantalla de pago es la
    // respuesta: ahí sube el justificante sin crear nada nuevo.
    const existing = quote.orders[0]?.reference ?? null;
    if (existing) {
      return NextResponse.json({ ok: true, url: buildSignedOrderUrl(existing, "pagar"), reference: existing });
    }

    if (quote.paidAt || normalizeQuoteStatus(quote.status) === "PAID") {
      return NextResponse.json({ ok: false, error: "Este presupuesto ya está pagado." }, { status: 400 });
    }
    if (quote.validUntil < new Date()) {
      return NextResponse.json(
        { ok: false, error: "Este presupuesto ha caducado. Escríbenos y lo actualizamos." },
        { status: 400 }
      );
    }
    if (!isQuotePayableStatus(normalizeQuoteStatus(quote.status))) {
      return NextResponse.json({ ok: false, error: "Este presupuesto no admite pago." }, { status: 400 });
    }
    if (quote.lines.length === 0) {
      return NextResponse.json({ ok: false, error: "El presupuesto no tiene líneas." }, { status: 409 });
    }
    const totalEur = decimalToNumber(quote.total);
    if (!totalEur || totalEur <= 0) {
      return NextResponse.json({ ok: false, error: "El presupuesto no tiene importe." }, { status: 409 });
    }

    const order = await createOrderShellFromQuote({
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      clientEmail: quote.customerEmail,
      clientName: quote.customerName,
      clientPhone: quote.customerPhone,
      sourceLang: quote.sourceLang,
      targetLang: quote.targetLang,
      totalEur,
      currency: quote.currency,
      documentCount: quote.lines.length,
      expedienteRef: quote.expedienteRef,
      deliveryType: quote.deliveryType,
      createdMessage: `Pedido creado desde el presupuesto ${quote.quoteNumber}: el cliente declara haber hecho la transferencia (sin cobro confirmado).`,
      lines: quote.lines.map((l) => ({
        description: l.description,
        unitPrice: decimalToNumber(l.unitPrice),
        sourceFileUrl: l.sourceFileUrl,
        pageStart: l.pageStart,
        pageEnd: l.pageEnd,
      })),
    });

    await prisma.orderEvent
      .create({
        data: {
          orderId: order.id,
          type: "payment.transfer_declared",
          message: "El cliente declara transferencia desde el presupuesto y va a subir el justificante.",
          payload: { quoteNumber: quote.quoteNumber, totalEur, source: "quote_public_page" },
        },
      })
      .catch((e) => console.error("[quote-declare-transfer] evento", e));

    // Aviso a staff: si el cliente dice que ha transferido y luego no sube nada,
    // que no se quede en silencio. Fire-and-forget, nunca bloquea la respuesta.
    void sendNewOrderStaffEmail({
      reference: order.reference,
      title: `Transferencia declarada (presupuesto ${quote.quoteNumber}) — pendiente de justificante`,
      amountCents: Math.round(totalEur * 100),
      clientEmail: quote.customerEmail,
      langPair: `${quote.sourceLang || "?"}->${quote.targetLang || "?"}`,
    }).catch((e) => console.error("[quote-declare-transfer] aviso staff", e));

    return NextResponse.json({
      ok: true,
      url: buildSignedOrderUrl(order.reference, "pagar"),
      reference: order.reference,
    });
  } catch (err) {
    console.error("[quotes:declare-transfer] error", err);
    return NextResponse.json({ ok: false, error: "No se pudo continuar. Inténtalo de nuevo." }, { status: 500 });
  }
}
