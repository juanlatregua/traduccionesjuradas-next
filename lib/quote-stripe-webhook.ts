import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripeIntentIdFromEvent } from "@/lib/quote-stripe";
import { decimalToNumber, calculateEtaDate, formatDateEs } from "@/lib/quotes";
import { buildPaidDigitalEmail, buildPaidPaperEmail } from "@/lib/quote-messages";
import { sendQuoteEmail } from "@/lib/quote-email";
import { isDuplicateStripeEventError } from "@/lib/quote-idempotency";
import { sendMail } from "@/lib/azure-mail";
import { sendStaffAlertSMS } from "@/lib/sms";
import { emailSendStatus } from "@/lib/message-status";
import { bridgeFailureAction, shouldSendPaidConfirmation } from "@/lib/money-alerts-math";

const BRIDGE_ATTEMPTS = 3;
const BRIDGE_BACKOFF_MS = [1000, 3000];

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
        publicToken: true,
        pdfLang: true,
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
        paymentFrozenAt: true,
        paymentFrozenReason: true,
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

    // Reintento de Stripe tras un puente fallido (se borró el StripeEventLog, abajo): el
    // cobro ya consta (PAID + este pago), así que no se repiten los registros; solo el puente.
    const reprocess =
      quote.status === "PAID" &&
      Boolean(stripeSessionId || stripePaymentIntentId) &&
      Boolean(
        await prisma.quotePayment.findFirst({
          where: {
            quoteId: quote.id,
            OR: [
              ...(stripeSessionId ? [{ stripeSessionId }] : []),
              ...(stripePaymentIntentId ? [{ stripePaymentIntentId }] : []),
            ],
          },
          select: { id: true },
        })
      );

    const now = new Date();
    const etaDate = calculateEtaDate({
      from: now,
      deliveryType: quote.deliveryType,
    });

    const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
    const paidData = {
      name: quote.customerName || "cliente",
      etaDate,
      quoteNumber: quote.quoteNumber,
      trackUrl: `${baseUrl}/q/${quote.publicToken}`,
      lang: quote.pdfLang,
    };
    const paidMessage =
      quote.deliveryType === "PAPER_SHIP" ? buildPaidPaperEmail(paidData) : buildPaidDigitalEmail(paidData);

    const whatsappDraft = buildPaidWhatsAppDraft({
      name: quote.customerName || "cliente",
      quoteNumber: quote.quoteNumber,
      etaDate,
    });

    if (!reprocess) await prisma.$transaction(async (tx) => {
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
          lostReason: null,
          lostReasonNote: null,
          lostFeedbackAt: null, // cierre suave por falta de respuesta: pagó, no está perdido
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

    // «Pago confirmado» DESPUÉS de registrar el cobro: si la transacción falla y Stripe
    // reintenta, el cliente no recibe el email dos veces. Graph no devuelve id de mensaje
    // (providerId siempre null): el éxito es que sendQuoteEmail no lance (auditoría 8-oct).
    const previousConfirmations = await prisma.messageLog.findMany({
      where: { quoteId: quote.id, type: "PAID_CONFIRMATION", channel: "EMAIL" },
      select: { status: true, recipient: true },
    });
    if (shouldSendPaidConfirmation(previousConfirmations)) {
      let providerId: string | null = null;
      let emailError: string | null = null;
      try {
        const sent = await sendQuoteEmail({
          to: quote.customerEmail,
          subject: paidMessage.subject,
          body: paidMessage.body,
        });
        providerId = sent.providerId;
      } catch (emailErr) {
        emailError = String((emailErr as any)?.message || emailErr || "unknown");
        console.error("[quotes:webhook] paid email send failed", emailErr);
      }
      await prisma.messageLog
        .create({
          data: {
            quoteId: quote.id,
            channel: "EMAIL",
            type: "PAID_CONFIRMATION",
            recipient: quote.customerEmail,
            subject: paidMessage.subject,
            body: emailError ? `${paidMessage.body}\n\n[ERROR]: ${emailError}` : paidMessage.body,
            sentAt: emailError === null ? now : null,
            providerId,
            status: emailSendStatus(emailError),
          },
        })
        .catch((err) => console.error("[quotes:webhook] paid email log failed", err));
    }

    // KEYSTONE: presupuesto pagado → crear el Pedido de producción + cascada
    // (mismo flujo que el funnel: workflow PAGO_VALIDADO, ETA francés,
    // auto-asignación de colaborador, emails). El Quote ya quedó PAID.
    const bridgeInput = {
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
      provider: "STRIPE" as const,
      providerEventId: stripePaymentIntentId || stripeSessionId || `quote:${quote.id}`,
      source: "quote_webhook",
      // El webhook ya envió su propio email de pago (buildPaidDigitalEmail con
      // ETA, arriba) → el puente NO debe mandar otro. Evita el doble email.
      sendClientPaidEmail: false,
      payload: { stripeEventId: String(event.id || ""), quoteId: quote.id },
      // Cobrado con el pago CONGELADO (sesión abierta antes de congelar): el dinero se
      // acepta, pero el encargo no sale solo hacia el jurado.
      skipAutoAssign: Boolean(quote.paymentFrozenAt),
    };
    if (quote.paymentFrozenAt && !reprocess) {
      const ficha = `https://www.traduccionesjuradas.net/zona-traductor/presupuestos/${quote.id}`;
      const aviso = `COBRADO CONGELADO: ${quote.quoteNumber} se ha pagado con tarjeta (${bridgeInput.quote.totalEur.toFixed(2)} €) estando el pago congelado. NO se ha asignado al jurado: revisar. ${quote.paymentFrozenReason || ""} ${ficha}`;
      await prisma.messageLog
        .create({ data: { quoteId: quote.id, channel: "EMAIL", type: "MARGIN_OVERRIDE", recipient: process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net", subject: `[precio-tras-envio] cobrado congelado ${quote.quoteNumber}`, body: aviso, sentAt: new Date(), status: "SENT" } })
        .catch((e) => console.error("[quotes:webhook] rastro cobrado congelado", e));
      await Promise.all([
        sendMail({ to: process.env.ADMIN_EMAIL || "info@traduccionesjuradas.net", subject: `⛔ ${quote.quoteNumber} COBRADO CONGELADO: revisar antes de asignar`, text: aviso, html: `<p>${aviso}</p>` }).catch((e) =>
          console.error("[quotes:webhook] aviso cobrado congelado email", e)
        ),
        sendStaffAlertSMS(aviso.slice(0, 300), `cobrado_congelado ${quote.quoteNumber}`).catch((e) => console.error("[quotes:webhook] aviso cobrado congelado SMS", e)),
      ]);
    }
    // El puente es idempotente por quoteId (cascarón) y por providerEventId (pago):
    // reintentar en el acto es seguro. Si sigue fallando, rastro + aviso por dos canales
    // y 500 para que Stripe reintente (sin el StripeEventLog, que lo daría por duplicado).
    const { runQuoteToOrderBridge } = await import("@/lib/quote-to-order");
    let bridgeErr: unknown = null;
    for (let attempt = 0; attempt < BRIDGE_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, BRIDGE_BACKOFF_MS[attempt - 1] ?? 3000));
      try {
        await runQuoteToOrderBridge(bridgeInput);
        bridgeErr = null;
        break;
      } catch (err) {
        bridgeErr = err;
        console.error(`[quotes:webhook] quote→order bridge failed (intento ${attempt + 1}/${BRIDGE_ATTEMPTS})`, err);
      }
    }
    const { alertQuoteBridgeFailure, alertQuoteBridgeResolved } = await import("@/lib/money-alerts");
    if (bridgeErr) {
      const failedDeliveries = await alertQuoteBridgeFailure({
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        customerEmail: quote.customerEmail,
        amountEur: bridgeInput.quote.totalEur,
        error: String((bridgeErr as any)?.message || bridgeErr),
        stripeEventId: String(event.id || ""),
      });
      // Tras N entregas fallidas se deja de pedir reintentos: lo cubre la conciliación de las 8:00.
      if (bridgeFailureAction(failedDeliveries) === "give_up") {
        return NextResponse.json({ ok: true, bridgeFailed: true, failedDeliveries });
      }
      await prisma.stripeEventLog
        .deleteMany({ where: { eventId: event.id } })
        .catch((err) => console.error("[quotes:webhook] no se pudo liberar el evento para el reintento", err));
      return NextResponse.json({ ok: false, error: "Pago registrado; el pedido no se pudo crear (Stripe reintentará)." }, { status: 500 });
    }
    await alertQuoteBridgeResolved({ quoteId: quote.id, quoteNumber: quote.quoteNumber });

    return NextResponse.json({ ok: true, ...(reprocess ? { reprocessed: true } : {}) });
  } catch (err: any) {
    console.error("[quotes:webhook] error", err);
    // Sin liberar el evento, el reintento de Stripe se daría por duplicado y el cobro quedaría a medias.
    await prisma.stripeEventLog.deleteMany({ where: { eventId: event.id } }).catch(() => {});
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
