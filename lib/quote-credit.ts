// lib/quote-credit.ts — Presupuesto → pedido A CRÉDITO (sin cobro previo).
//
// Hasta el 2-sep-2026 un pedido solo nacía cuando entraba el dinero (mark-paid y
// el webhook de Stripe son los únicos que llaman a runQuoteToOrderBridge). Con
// clientes de crédito el trabajo va al revés: aprueban, se traduce, se entrega
// y pagan a 30 días. Este módulo crea la cáscara del pedido SIN pago y delega
// en lib/credit.ts (factura emitida con vencimiento = "asegurado").
//
// Lo que NO hace, a propósito:
//   · NO toca el Quote: se queda ACCEPTED/SENT para que el enlace de pago de
//     /q/[token] siga vivo y el cliente pueda pagar cuando le toque. El cron de
//     caducidad ya excluye los presupuestos con pedido.
//   · NO crea QuotePayment ni marca paidAt. Cuando pague, mark-paid (o el
//     webhook) reutiliza este mismo pedido: createOrderShellFromQuote es
//     idempotente por quoteId.
//   · Comprueba al cliente ANTES de crear el pedido: si el bloqueo es suyo
//     (sin permiso, sin NIF, fuera de España) no queda un pedido huérfano.

import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/quotes";
import { createOrderShellFromQuote } from "@/lib/orders";
import { authorizeCredit, CreditError } from "@/lib/credit";
import { customerCreditBlocker } from "@/lib/credit-terms";

const CREDITABLE = new Set(["DRAFT", "SENT", "OPENED", "ACCEPTED"]);

export async function authorizeQuoteCredit(input: {
  quoteId: string;
  actorEmail: string;
  reason: string;
  dueDate?: string | null;
}) {
  const quote = await prisma.quote.findUnique({
    where: { id: input.quoteId },
    select: {
      id: true,
      status: true,
      quoteNumber: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      sourceLang: true,
      targetLang: true,
      expedienteRef: true,
      deliveryType: true,
      total: true,
      currency: true,
      paidAt: true,
      lines: { select: { description: true, unitPrice: true, sourceFileUrl: true, pageStart: true, pageEnd: true } },
      orders: { select: { reference: true }, orderBy: { createdAt: "desc" }, take: 1 },
      customer: {
        select: { name: true, email: true, fiscalName: true, nif: true, country: true, creditEnabled: true, creditDays: true },
      },
    },
  });
  if (!quote) throw new CreditError("Presupuesto no encontrado.", 404);
  if (quote.paidAt || quote.status === "PAID") throw new CreditError("Este presupuesto ya está pagado.", 409);

  const existing = quote.orders[0]?.reference ?? null;
  if (!existing && !CREDITABLE.has(quote.status)) {
    throw new CreditError(`El presupuesto está en estado ${quote.status}; no se puede autorizar a crédito.`, 400);
  }
  if (quote.lines.length === 0) throw new CreditError("El presupuesto no tiene líneas.", 409);

  const totalEur = decimalToNumber(quote.total);
  if (!totalEur || totalEur <= 0) throw new CreditError("El presupuesto no tiene importe.", 409);

  // Mismo mensaje que daría authorizeCredit, pero ANTES de crear nada.
  const blocker = customerCreditBlocker(quote.customer);
  if (blocker) throw new CreditError(blocker, quote.customer?.creditEnabled ? 409 : 403);

  const order = existing
    ? { reference: existing }
    : await createOrderShellFromQuote({
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
        createdMessage: `Pedido creado A CRÉDITO desde el presupuesto ${quote.quoteNumber} (sin cobro previo).`,
        lines: quote.lines.map((l) => ({
          description: l.description,
          unitPrice: decimalToNumber(l.unitPrice),
          sourceFileUrl: l.sourceFileUrl,
          pageStart: l.pageStart,
          pageEnd: l.pageEnd,
        })),
      });

  const result = await authorizeCredit({
    reference: order.reference,
    actorEmail: input.actorEmail,
    reason: input.reason,
    dueDate: input.dueDate || null,
  });

  return { ...result, orderReference: order.reference, createdOrder: !existing };
}
