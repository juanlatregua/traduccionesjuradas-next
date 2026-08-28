// lib/quote-send.ts — Finalizar y enviar un presupuesto (PDF + email + WhatsApp +
// transiciones de pedidos enlazados). Chokepoint único: lo usan el botón Enviar
// del staff (POST /api/quotes/[id]/finalize-send) y el agente de precios
// (lib/learned-rates.ts) cuando emite un presupuesto solo.

import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/quotes";
import { buildQuotePdfBuffer, hashPdf, uploadFinalQuotePdf } from "@/lib/quote-pdf";
import { buildPayLinkEmail, buildWhatsAppPayText } from "@/lib/quote-messages";
import { sendQuoteEmailWithRetry, isPlaceholderEmail } from "@/lib/quote-email";
import { transitionWorkflowState } from "@/lib/workflow-server";

export class QuoteSendError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const MAX_EMAIL_ATTACH_BYTES = 15 * 1024 * 1024;

export async function finalizeAndSendQuote(opts: {
  quoteId: string;
  actorEmail: string;
  skipEmail?: boolean;
  customSubject?: string;
  customBody?: string;
}): Promise<{ pdfUrl: string; payUrl: string; whatsappText: string; emailSent: boolean }> {
  const quote = await prisma.quote.findUnique({
    where: { id: opts.quoteId },
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!quote) throw new QuoteSendError("Presupuesto no encontrado.", 404);
  if (["PAID", "IN_PROGRESS", "DELIVERED", "EXPIRED"].includes(quote.status)) {
    throw new QuoteSendError(`No se puede enviar en estado ${quote.status}.`, 400);
  }

  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");

  // Pedidos enlazados: el pago va por el enlace firmado del pedido, no por /q.
  const linkedOrders = await prisma.order.findMany({
    where: { quoteId: quote.id },
    select: { id: true, reference: true, events: { orderBy: { createdAt: "desc" }, take: 30 } },
  });
  const primaryLinkedOrder = linkedOrders[0] || null;
  const { buildSignedOrderUrl } = await import("@/lib/order-token");
  const payUrl = primaryLinkedOrder ? buildSignedOrderUrl(primaryLinkedOrder.reference, "pagar") : `${baseUrl}/q/${quote.publicToken}`;

  const pdfBuffer = buildQuotePdfBuffer({
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    sourceLang: quote.sourceLang,
    targetLang: quote.targetLang,
    deliveryType: quote.deliveryType,
    issuedAt: quote.issuedAt,
    validUntil: quote.validUntil,
    subtotal: decimalToNumber(quote.subtotal),
    discountAmount: decimalToNumber(quote.discountAmount),
    shippingAmount: decimalToNumber(quote.shippingAmount),
    vatRate: decimalToNumber(quote.vatRate),
    vatAmount: decimalToNumber(quote.vatAmount),
    total: decimalToNumber(quote.total),
    payUrl,
    lines: quote.lines.map((line) => ({
      description: line.description,
      quantity: decimalToNumber(line.quantity),
      unitPrice: decimalToNumber(line.unitPrice),
      lineTotal: decimalToNumber(line.lineTotal),
    })),
    isDraft: false,
    notesLegal: quote.notesLegal,
    deliveryTerm: quote.deliveryTerm,
    holderNames: quote.holderNames,
    translatorName: quote.translatorName,
    translatorMaec: quote.translatorMaec,
    paymentMethods: quote.paymentMethods,
    contactWhatsapp: quote.contactWhatsapp,
    lang: quote.pdfLang,
  });

  const [pdfUrl, pdfHash] = await Promise.all([
    uploadFinalQuotePdf({ quoteNumber: quote.quoteNumber, buffer: pdfBuffer }),
    Promise.resolve(hashPdf(pdfBuffer)),
  ]);

  // Sin email si el staff lo pide o si el email es marcador de WhatsApp (no
  // entregable). El PDF y el texto de WhatsApp se generan igual.
  const placeholderEmail = isPlaceholderEmail(quote.customerEmail);
  const doSendEmail = !opts.skipEmail && !placeholderEmail;

  const standardCopy = buildPayLinkEmail({
    name: quote.customerName || "cliente",
    payUrl,
    translatorName: quote.translatorName,
    translatorMaec: quote.translatorMaec,
    paymentMethods: quote.paymentMethods,
  });
  const customSubject = String(opts.customSubject || "").trim();
  const customBody = String(opts.customBody || "").trim();
  const emailCopy = customSubject && customBody ? { subject: customSubject.slice(0, 200), body: customBody.slice(0, 8000) } : standardCopy;
  let sendResult: { providerId?: string | null } = {};
  if (doSendEmail) {
    // El PDF va ADJUNTO, no solo enlazado: el cliente lo quiere para guardarlo,
    // imprimirlo o reenviarlo a su gestor, y el enlace obliga a un paso mas (y no
    // sirve sin conexion). Ya lo tenemos en memoria, no hay que volver a bajarlo.
    const attachments =
      pdfBuffer.length > 0 && pdfBuffer.length <= MAX_EMAIL_ATTACH_BYTES
        ? [{
            name: `Presupuesto-${quote.quoteNumber}.pdf`,
            contentType: "application/pdf",
            contentBytes: pdfBuffer.toString("base64"),
          }]
        : [];
    if (!attachments.length) {
      console.warn(`[quote-send] ${quote.quoteNumber}: PDF de ${pdfBuffer.length} bytes, se envia el email SOLO con enlace.`);
    }
    sendResult = await sendQuoteEmailWithRetry({ to: quote.customerEmail, subject: emailCopy.subject, body: emailCopy.body, attachments });
  }

  const plazoMatch = quote.notesLegal?.match(/Plazo de entrega:\s*([^.]+)/);
  const whatsappBody = buildWhatsAppPayText({
    name: quote.customerName || "cliente",
    totalEur: decimalToNumber(quote.total),
    deliveryType: quote.deliveryType,
    plazo: quote.deliveryTerm || (plazoMatch ? plazoMatch[1].trim() : null),
    paymentMethods: quote.paymentMethods,
    sourceLang: quote.sourceLang,
    targetLang: quote.targetLang,
    payUrl,
    translatorName: quote.translatorName,
    translatorMaec: quote.translatorMaec,
    vatNote: Number(quote.vatRate) > 0 ? undefined : "operación no sujeta a IVA — residente fuera de la UE",
  });

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.quote.update({
      where: { id: quote.id },
      data: {
        pdfUrl,
        pdfHash,
        status: quote.status === "DRAFT" ? "SENT" : quote.status,
        sentAt: quote.sentAt || now,
        adminSentBy: opts.actorEmail,
      },
    });
    if (doSendEmail) {
      await tx.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: "EMAIL",
          type: quote.sentAt ? "RESEND_PAY_LINK" : "PAY_LINK",
          recipient: quote.customerEmail,
          subject: emailCopy.subject,
          body: emailCopy.body,
          sentAt: now,
          providerId: sendResult.providerId,
          status: "SENT",
        },
      });
    }
    await tx.messageLog.create({
      data: {
        quoteId: quote.id,
        channel: "WHATSAPP",
        type: "DRAFT_WHATSAPP",
        recipient: quote.customerPhone || quote.customerEmail,
        subject: null,
        body: whatsappBody,
        sentAt: null,
        providerId: null,
        status: "DRAFT",
      },
    });
  });

  // Pedidos enlazados: PENDIENTE_REVISION → PRESUPUESTO_ENVIADO → PENDIENTE_PAGO.
  for (const linkedOrder of linkedOrders) {
    try {
      const wasAutoQuote = quote.adminCreatedBy === "system:auto";
      let adminModified = false;
      if (wasAutoQuote) {
        const autoQuoteEvent = linkedOrder.events.find((e: any) => e.type === "order.auto_quote_created");
        if (autoQuoteEvent) {
          const originalTotal = Number((autoQuoteEvent.payload as any)?.total ?? 0);
          adminModified = Math.abs(originalTotal - decimalToNumber(quote.total)) > 0.01;
        }
      }
      const firstLine = quote.lines[0];
      await prisma.orderEvent.create({
        data: {
          orderId: linkedOrder.id,
          type: "order.quote_final_snapshot",
          message: `Snapshot final del presupuesto ${quote.quoteNumber} al enviar.`,
          payload: {
            quoteId: quote.id,
            quoteNumber: quote.quoteNumber,
            finalWords: firstLine ? decimalToNumber(firstLine.quantity) : 0,
            finalUnitPrice: firstLine ? decimalToNumber(firstLine.unitPrice) : 0,
            finalSubtotal: decimalToNumber(quote.subtotal),
            finalTotal: decimalToNumber(quote.total),
            linesCount: quote.lines.length,
            adminModified,
            sentBy: opts.actorEmail,
          },
        },
      });
      await transitionWorkflowState({
        reference: linkedOrder.reference,
        to: "PRESUPUESTO_ENVIADO",
        actorEmail: opts.actorEmail,
        reason: `Presupuesto ${quote.quoteNumber} enviado al cliente.`,
      });
      await transitionWorkflowState({
        reference: linkedOrder.reference,
        to: "PENDIENTE_PAGO",
        actorEmail: opts.actorEmail,
        reason: `Pago habilitado tras envio de presupuesto ${quote.quoteNumber}.`,
      });
      await prisma.orderEvent.create({
        data: {
          orderId: linkedOrder.id,
          type: "order.quote_sent_payment_enabled",
          message: `Presupuesto ${quote.quoteNumber} enviado. Pago habilitado.`,
          payload: { quoteId: quote.id, quoteNumber: quote.quoteNumber, actorEmail: opts.actorEmail },
        },
      });
    } catch (transitionErr) {
      console.error(`[quote-send] failed to transition order ${linkedOrder.reference}`, transitionErr);
    }
  }

  return { pdfUrl, payUrl, whatsappText: whatsappBody, emailSent: doSendEmail };
}
