// lib/quote-to-order.ts — Puente compartido presupuesto pagado → pedido.
// Lo usan el webhook de Stripe de quotes y el pago manual (Bizum/transferencia).
// Crea el Order de producción, marca el pago (idempotente) y dispara la cascada
// (workflow PAGO_VALIDADO, ETA francés, auto-asignación de colaborador).

import { createOrderShellFromQuote, updateOrderPayment } from "@/lib/orders";
import { sendNewOrderStaffEmail } from "@/lib/email";
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
  lines: { description: string; unitPrice: number }[];
};

export async function runQuoteToOrderBridge(input: {
  quote: QuoteForBridge;
  provider: PaymentMethod;
  providerEventId: string;
  source: string;
  payload?: Record<string, unknown>;
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
    lines: quote.lines,
  });

  const paymentUpdate = await updateOrderPayment(order.reference, input.provider, input.providerEventId, {
    source: input.source,
    payload: input.payload,
  });

  if (paymentUpdate.changed) {
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

    // Aviso a staff — antes los pedidos vía presupuesto NO avisaban a nadie.
    // Mismo email que el funnel (a PRESUPUESTO_TO). Fire-and-forget con retry;
    // si agota reintentos persiste en FailedEmail (lo reporta el digest diario).
    const langPair =
      [quote.sourceLang, quote.targetLang].filter(Boolean).join("→") || undefined;
    sendEmailWithRetry(() =>
      sendNewOrderStaffEmail({
        reference: order.reference,
        title: `Presupuesto ${quote.quoteNumber}`,
        amountCents: Math.round(quote.totalEur * 100),
        clientEmail: quote.customerEmail,
        langPair,
      })
    ).catch((e) => console.error("[quote-to-order] staff new-order email failed", e));

    void import("@/lib/sms")
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
