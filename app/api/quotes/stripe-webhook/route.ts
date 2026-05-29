import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyQuoteStripeWebhookSignature, getStripeIntentIdFromEvent } from "@/lib/quote-stripe";
import { decimalToNumber, calculateEtaDate, formatDateEs } from "@/lib/quotes";
import { buildPaidDigitalEmail, buildPaidPaperEmail } from "@/lib/quote-messages";
import { sendQuoteEmail } from "@/lib/quote-email";
import { isDuplicateStripeEventError } from "@/lib/quote-idempotency";

export const runtime = "nodejs";

function buildPaidWhatsAppDraft(params: { name: string; quoteNumber: string; etaDate: Date }) {
  return `Hola ${params.name}, desde TraduccionesJuradas.net confirmamos el pago del presupuesto ${params.quoteNumber}. Fecha estimada de entrega: ${formatDateEs(params.etaDate)}.`;
}

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

  if (event.type !== "checkout.session.completed" && event.type !== "payment_intent.succeeded") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const obj = event.data.object as any;
  const metadata = obj?.metadata || {};
  const quoteId = String(metadata.quoteId || "").trim();
  const quoteNumberFromMetadata = String(metadata.quoteNumber || "").trim();
  const deliveryTypeFromMetadata = String(metadata.deliveryType || "").trim();
  const quoteToken = String(metadata.quoteToken || "").trim();
  const stripeSessionId =
    event.type === "checkout.session.completed" ? String(obj?.id || "") : String(obj?.checkout_session || "");
  const stripePaymentIntentId = getStripeIntentIdFromEvent(event) || "";
  const currency = String(obj?.currency || "eur").toUpperCase();
  const amountRaw =
    event.type === "checkout.session.completed"
      ? Number(obj?.amount_total || 0) / 100
      : Number(obj?.amount_received || obj?.amount || 0) / 100;

  try {
    try {
      await prisma.stripeEventLog.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          quoteId: quoteId || null,
          payload: {
            quoteNumberFromMetadata,
            deliveryTypeFromMetadata,
            quoteToken,
            stripeSessionId,
            stripePaymentIntentId,
          },
        },
      });
    } catch (err: any) {
      if (isDuplicateStripeEventError(err)) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      throw err;
    }

    if (!quoteId) {
      console.warn("[quotes:webhook] event without quoteId metadata", event.id);
      return NextResponse.json({ ok: true, ignored: true });
    }

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        status: true,
        quoteNumber: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        deliveryType: true,
        total: true,
        sourceLang: true,
        targetLang: true,
        expedienteRef: true,
        lines: { select: { description: true, unitPrice: true } },
      },
    });
    if (!quote) {
      console.warn("[quotes:webhook] quote not found", quoteId);
      return NextResponse.json({ ok: true, ignored: true });
    }

    const now = new Date();
    const etaDate = calculateEtaDate({
      from: now,
      deliveryType: quote.deliveryType,
    });

    const paidMessage =
      quote.deliveryType === "PAPER_SHIP"
        ? buildPaidPaperEmail({ name: quote.customerName || "cliente", etaDate })
        : buildPaidDigitalEmail({ name: quote.customerName || "cliente", etaDate });

    let providerId: string | null = null;
    try {
      const sent = await sendQuoteEmail({
        to: quote.customerEmail,
        subject: paidMessage.subject,
        body: paidMessage.body,
      });
      providerId = sent.providerId;
    } catch (emailErr) {
      console.error("[quotes:webhook] paid email send failed", emailErr);
    }

    const whatsappDraft = buildPaidWhatsAppDraft({
      name: quote.customerName || "cliente",
      quoteNumber: quote.quoteNumber,
      etaDate,
    });

    await prisma.$transaction(async (tx) => {
      const existingPayment =
        stripePaymentIntentId || stripeSessionId
          ? await tx.quotePayment.findFirst({
              where: {
                quoteId: quote.id,
                OR: [
                  stripePaymentIntentId
                    ? {
                        stripePaymentIntentId,
                      }
                    : undefined,
                  stripeSessionId
                    ? {
                        stripeSessionId,
                      }
                    : undefined,
                ].filter(Boolean) as any,
              },
              select: { id: true },
            })
          : null;

      if (!existingPayment) {
        await tx.quotePayment.create({
          data: {
            quoteId: quote.id,
            provider: "STRIPE",
            amount: amountRaw > 0 ? amountRaw : decimalToNumber(quote.total),
            currency,
            stripeSessionId: stripeSessionId || null,
            stripePaymentIntentId: stripePaymentIntentId || null,
          },
        });
      }

      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: "PAID",
          paidAt: now,
        },
      });

      await tx.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: "EMAIL",
          type: "PAID_CONFIRMATION",
          recipient: quote.customerEmail,
          subject: paidMessage.subject,
          body: paidMessage.body,
          sentAt: providerId ? now : null,
          providerId,
          status: providerId ? "SENT" : "FAILED",
        },
      });

      await tx.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: "WHATSAPP",
          type: "DRAFT_WHATSAPP",
          recipient: quote.customerPhone || quote.customerEmail,
          subject: null,
          body: whatsappDraft,
          sentAt: null,
          providerId: null,
          status: "DRAFT",
        },
      });
    });

    // KEYSTONE: presupuesto pagado → crear el Pedido de producción + cascada
    // (mismo flujo que el funnel: workflow PAGO_VALIDADO, ETA francés,
    // auto-asignación de colaborador, emails). No rompe el webhook si falla:
    // el Quote ya quedó PAID.
    try {
      const { runQuoteToOrderBridge } = await import("@/lib/quote-to-order");
      await runQuoteToOrderBridge({
        quote: {
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          customerEmail: quote.customerEmail,
          customerName: quote.customerName,
          customerPhone: quote.customerPhone,
          sourceLang: quote.sourceLang,
          targetLang: quote.targetLang,
          totalEur: amountRaw > 0 ? amountRaw : decimalToNumber(quote.total),
          currency,
          expedienteRef: quote.expedienteRef,
          lines: quote.lines.map((l) => ({
            description: l.description,
            unitPrice: decimalToNumber(l.unitPrice),
          })),
        },
        provider: "STRIPE",
        providerEventId: stripePaymentIntentId || stripeSessionId || `quote:${quote.id}`,
        source: "quote_webhook",
        payload: { stripeEventId: String(event.id || ""), quoteId: quote.id },
      });
    } catch (bridgeErr) {
      console.error("[quotes:webhook] quote→order bridge failed", bridgeErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[quotes:webhook] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error procesando webhook." },
      { status: 500 }
    );
  }
}
