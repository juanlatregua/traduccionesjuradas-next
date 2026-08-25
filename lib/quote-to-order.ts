// lib/quote-to-order.ts — Puente compartido presupuesto pagado → pedido.
// Lo usan el webhook de Stripe de quotes y el pago manual (Bizum/transferencia).
// Crea el Order de producción, marca el pago (idempotente) y dispara la cascada
// (workflow PAGO_VALIDADO, ETA francés, auto-asignación de colaborador).

import { createOrderShellFromQuote, updateOrderPayment } from "@/lib/orders";
import { isPlaceholderEmail } from "@/lib/azure-mail";
import { excludeFromBillingIfBizum } from "@/lib/billing-exclusion";
import { sendNewOrderStaffEmail, sendPaymentConfirmedEmail } from "@/lib/email";
import { sendEmailWithRetry } from "@/lib/email-retry";
import type { PaymentMethod } from "@prisma/client";

export type QuoteForBridge = {
  id: string;
  quoteNumber: string;
  customerEmail: string;
  customerName?: string | null;
  customerPhone?: string | null;
  sourceLang?: string | null;
  targetLang?: string | null;
  totalEur: number;
  currency?: string | null;
  expedienteRef?: string | null;
  deliveryType?: string | null; // QuoteDeliveryType (PAPER_SHIP → pedido en papel)
  // sourceFileUrl viaja hasta el pedido: sin él, un presupuesto hecho con
  // documentos soltados a mano en el builder (sin expediente) creaba un pedido
  // SIN archivos, y el colaborador externo recibía el encargo vacío.
  lines: {
    description: string;
    unitPrice: number;
    sourceFileUrl?: string | null;
    pageStart?: number | null;
    pageEnd?: number | null;
  }[];
};

export async function runQuoteToOrderBridge(input: {
  quote: QuoteForBridge;
  provider: PaymentMethod;
  providerEventId: string;
  source: string;
  payload?: Record<string, unknown>;
  // El puente es el chokepoint común del pago de presupuesto (mark-paid manual
  // Y webhook Stripe-quotes). El webhook YA manda su propio email de pago rico
  // (buildPaidDigitalEmail con ETA) → pasa false para no duplicar. El pago
  // manual no mandaba ninguno → lo deja en true (default) y lo envía el puente.
  sendClientPaidEmail?: boolean;
}) {
  const { quote } = input;

  const order = await createOrderShellFromQuote({
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    clientEmail: quote.customerEmail,
    clientName: quote.customerName,
    clientPhone: quote.customerPhone,
    sourceLang: quote.sourceLang,
    targetLang: quote.targetLang,
    totalEur: quote.totalEur,
    currency: quote.currency,
    documentCount: quote.lines.length,
    expedienteRef: quote.expedienteRef,
    deliveryType: quote.deliveryType,
    lines: quote.lines,
  });

  const paymentUpdate = await updateOrderPayment(order.reference, input.provider, input.providerEventId, {
    source: input.source,
    payload: input.payload,
  });

  if (paymentUpdate.changed) {
    // Bizum ⇒ sin factura (regla Juan 21-ago-2026).
    await excludeFromBillingIfBizum(order.id, input.provider).catch((e) =>
      console.error("[quote-to-order] billing exclusion failed", e)
    );
    const { transitionWorkflowState, assignDefaultFrenchEtaIfNeeded, autoAssignCollaboratorIfNeeded } =
      await import("@/lib/workflow-server");
    await transitionWorkflowState({
      reference: order.reference,
      to: "PAGO_VALIDADO",
      actorEmail: input.source,
      reason: "Pago de presupuesto validado.",
    }).catch((e) => console.error("[quote-to-order] workflow transition failed", e));
    await assignDefaultFrenchEtaIfNeeded({ reference: order.reference, actorEmail: input.source }).catch((e) =>
      console.error("[quote-to-order] FR ETA failed", e)
    );
    await autoAssignCollaboratorIfNeeded({ reference: order.reference, actorEmail: input.source }).catch((e) =>
      console.error("[quote-to-order] auto collaborator failed", e)
    );

    // Aviso al CLIENTE: pago confirmado. Antes el pago MANUAL de presupuesto solo
    // avisaba a staff → el cliente pagaba (Bizum/transferencia) y no recibía nada.
    // Reusa la MISMA plantilla es/fr que los pedidos directos (Stripe/Redsys/PayPal).
    // Fire-and-forget con retry → FailedEmail si agota. Se omite cuando el caller
    // ya mandó su propio email de pago (webhook Stripe-quotes) para no duplicar.
    // NOTA: order.clientLocale aún no se propaga desde el Quote (default "es");
    // los presupuestos FR saldrían en es hasta que se propague el locale.
    // Cliente solo-WhatsApp (email-marcador @whatsapp.local, que sendMail filtra):
    // el "pago confirmado" va por SMS al teléfono, con la misma plantilla que los
    // pagos online (incidente 21-ago: Anton, 26_2DF935, pagó por Bizum y no
    // recibió nada; el email rebotó al buzón de la casa).
    if (isPlaceholderEmail(quote.customerEmail) && input.sendClientPaidEmail !== false) {
      try {
        const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
        const { smsPagoConfirmado, formatDeliveryPlazo } = await import("@/lib/sms-templates");
        const { buildSignedOrderUrl } = await import("@/lib/order-token");
        const phone = await getOrderPhone(order.id).catch(() => null);
        if (phone) {
          const lang = order.clientLocale === "fr" ? "fr" : "es";
          const res = await sendNotification({
            to: formatPhoneSpain(phone),
            body: smsPagoConfirmado({
              ref: order.reference,
              plazo: formatDeliveryPlazo(order.dueDate, lang),
              url: buildSignedOrderUrl(order.reference, "estado"),
              lang,
            }),
          });
          if (!res.ok) console.error("[quote-to-order] SMS pago confirmado falló:", res.error);
        }
      } catch (e) {
        console.error("[quote-to-order] SMS pago confirmado error", e);
      }
    }

    if (quote.customerEmail && !isPlaceholderEmail(quote.customerEmail) && input.sendClientPaidEmail !== false) {
      const lang = order.clientLocale === "fr" ? "fr" : "es";
      sendEmailWithRetry(() =>
        sendPaymentConfirmedEmail({
          toEmail: quote.customerEmail,
          reference: order.reference,
          title: order.title,
          amountCents: Math.round((quote.totalEur || 0) * 100),
          method: input.provider,
          lang,
        })
      ).catch((e) => console.error("[quote-to-order] client payment-confirmed email failed", e));
    }

    // Aviso a staff — antes los pedidos vía presupuesto NO avisaban a nadie.
    // Mismo email que el funnel (a PRESUPUESTO_TO). Fire-and-forget con retry;
    // si agota reintentos persiste en FailedEmail (lo reporta el digest diario).
    const langPair =
      [quote.sourceLang, quote.targetLang].filter(Boolean).join("→") || undefined;
    // CON await (25-ago-2026, caso 26_34F612): en la lambda del webhook de Stripe
    // el fire-and-forget moría al responder y el SMS «PAGO …» nunca salía; Juan se
    // enteró del pedido por lavori. Lección del E2E del 12-ago, misma causa.
    await sendEmailWithRetry(() =>
      sendNewOrderStaffEmail({
        reference: order.reference,
        title: `Presupuesto ${quote.quoteNumber}`,
        amountCents: Math.round(quote.totalEur * 100),
        clientEmail: quote.customerEmail,
        langPair,
      })
    ).catch((e) => console.error("[quote-to-order] staff new-order email failed", e));

    await import("@/lib/sms")
      .then(({ sendStaffNewOrderSMS }) =>
        sendStaffNewOrderSMS({
          reference: order.reference,
          amountCents: Math.round(quote.totalEur * 100),
          langPair,
          via: "Presupuesto",
        })
      )
      .catch((e) => console.error("[quote-to-order] staff payment SMS failed", e));
  }

  return order;
}
