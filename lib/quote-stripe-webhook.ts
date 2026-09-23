import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripeIntentIdFromEvent } from "@/lib/quote-stripe";
import { decimalToNumber, calculateEtaDate, formatDateEs } from "@/lib/quotes";
import { buildPaidDigitalEmail, buildPaidPaperEmail } from "@/lib/quote-messages";
import { sendQuoteEmail } from "@/lib/quote-email";
import { isDuplicateStripeEventError } from "@/lib/quote-idempotency";
import { sendMail } from "@/lib/azure-mail";
import { sendStaffAlertSMS } from "@/lib/sms";

function buildPaidWhatsAppDraft(params: { name: string; quoteNumber: string; etaDate: Date }) {
  return `Hola ${params.name}, desde TraduccionesJuradas.net confirmamos el pago del presupuesto ${params.quoteNumber}. Fecha estimada de entrega: ${formatDateEs(params.etaDate)}.`;
}

/**
 * Procesa un evento de Stripe ya verificado que corresponde al pago de un
 * presupuesto (Quote). Lo invocan dos entradas:
 *  - el endpoint dedicado /api/quotes/stripe-webhook (firma con STRIPE_QUOTES_WEBHOOK_SECRET)
 *  - el webhook principal /api/payment/stripe/webhook cuando el evento trae
 *    metadata.quoteId (firma con STRIPE_WEBHOOK_SECRET) — así el presupuesto
 *    se procesa aunque el endpoint dedicado no esté registrado en Stripe.
 * Idempotente vía StripeEventLog.eventId (unique): un evento entregado a ambos
 * endpoints se procesa una sola vez.
 */
export async function processQuoteStripeEvent(event: any) {
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
        balanceAmount: true,
        balancePaidAt: true,
        lines: { select: { description: true, unitPrice: true, sourceFileUrl: true, pageStart: true, pageEnd: true } },
      },
    });
    if (!quote) {
      console.warn("[quotes:webhook] quote not found", quoteId);
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (metadata.paymentKind === "balance") {
      return processBalancePayment({
        quote,
        amountEur: amountRaw > 0 ? amountRaw : decimalToNumber(quote.balanceAmount),
        currency,
        stripeSessionId,
        stripePaymentIntentId,
      });
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
          deliveryType: quote.deliveryType,
          lines: quote.lines.map((l) => ({
            description: l.description,
            unitPrice: decimalToNumber(l.unitPrice),
            sourceFileUrl: l.sourceFileUrl,
            pageStart: l.pageStart,
            pageEnd: l.pageEnd,
          })),
        },
        provider: "STRIPE",
        providerEventId: stripePaymentIntentId || stripeSessionId || `quote:${quote.id}`,
        source: "quote_webhook",
        // El webhook ya envió su propio email de pago (buildPaidDigitalEmail con
        // ETA, arriba) → el puente NO debe mandar otro. Evita el doble email.
        sendClientPaidEmail: false,
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

// Segundo plazo (Quote.balanceAmount): suma al pedido que ya creó el primer pago.
// Nunca pasa por runQuoteToOrderBridge (sería otro pedido y otro encargo al jurado).
async function processBalancePayment(input: {
  quote: { id: string; quoteNumber: string; customerName: string; customerEmail: string };
  amountEur: number;
  currency: string;
  stripeSessionId: string;
  stripePaymentIntentId: string;
}) {
  const { quote, amountEur, currency, stripeSessionId, stripePaymentIntentId } = input;
  const amountCents = Math.round(amountEur * 100);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const flipped = await tx.quote.updateMany({
      where: { id: quote.id, balancePaidAt: null },
      data: { balancePaidAt: now },
    });
    if (flipped.count !== 1) return null;
    await tx.quotePayment.create({
      data: {
        quoteId: quote.id,
        provider: "STRIPE",
        amount: amountEur,
        currency,
        stripeSessionId: stripeSessionId || null,
        stripePaymentIntentId: stripePaymentIntentId || null,
      },
    });
    const order = await tx.order.findFirst({ where: { quoteId: quote.id }, select: { id: true, reference: true } });
    if (order) {
      await tx.order.update({ where: { id: order.id }, data: { amountCents: { increment: amountCents } } });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "payment.balance_received",
          message: `Segundo pago del presupuesto ${quote.quoteNumber} cobrado con tarjeta.`,
          payload: { amountCents, stripeSessionId, stripePaymentIntentId },
        },
      });
    }
    return { orderRef: order?.reference || null };
  });

  const importe = `${amountEur.toFixed(2).replace(".", ",")} €`;
  if (!result) {
    const known = await prisma.quotePayment.findFirst({
      where: {
        quoteId: quote.id,
        OR: [
          ...(stripeSessionId ? [{ stripeSessionId }] : []),
          ...(stripePaymentIntentId ? [{ stripePaymentIntentId }] : []),
        ],
      },
      select: { id: true },
    });
    if (!known) {
      const doble = `⚠ POSIBLE DOBLE COBRO: segundo pago ${importe} de ${quote.quoteNumber} ya estaba pagado (sesión ${stripeSessionId}). Revisar en Stripe y devolver.`;
      await sendStaffAlertSMS(doble, "doble cobro segundo pago").catch((e) => console.error("[quotes:webhook] doble cobro SMS", e));
      if (process.env.PRESUPUESTO_TO) {
        await sendMail({ to: process.env.PRESUPUESTO_TO, subject: doble, text: doble, html: `<p>${doble}</p>` }).catch((e) =>
          console.error("[quotes:webhook] doble cobro email", e)
        );
      }
    }
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await sendQuoteEmail({
    to: quote.customerEmail,
    subject: `Segundo pago recibido — Presupuesto ${quote.quoteNumber}`,
    body: `Hola ${quote.customerName || ""},\n\nHemos recibido el segundo pago de ${importe} del presupuesto ${quote.quoteNumber}. Con él queda pagado en su totalidad.\n\nGracias por su confianza.\n\nTraduccionesJuradas.net`,
  }).catch((e) => console.error("[quotes:webhook] balance client email failed", e));

  const aviso = result.orderRef
    ? `SEGUNDO PAGO ${importe} · ${quote.quoteNumber} · pedido ${result.orderRef} ya sumado.`
    : `SEGUNDO PAGO ${importe} · ${quote.quoteNumber} · ⚠ SIN PEDIDO: el primer pago no creó pedido, revisar a mano.`;
  const staffTo = process.env.PRESUPUESTO_TO;
  if (staffTo) {
    await sendMail({ to: staffTo, subject: aviso, text: aviso, html: `<p>${aviso}</p>` }).catch((e) =>
      console.error("[quotes:webhook] balance staff email failed", e)
    );
  }
  await sendStaffAlertSMS(aviso, "segundo pago presupuesto").catch((e) =>
    console.error("[quotes:webhook] balance staff SMS failed", e)
  );

  return NextResponse.json({ ok: true, balance: true });
}
