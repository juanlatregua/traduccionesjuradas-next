// app/api/quotes/[id]/send-paid-receipt/route.ts
// STAFF: envía al cliente el presupuesto sellado PAGADO como recibo (PDF adjunto).
// Reusa buildQuotePdfBuffer (mismo mapeo que preview-pdf) + sendMail con adjunto.
// No emite factura fiscal: para eso está /api/orders/[reference]/invoice/issue.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { decimalToNumber } from "@/lib/quotes";
import { buildQuotePdfBuffer } from "@/lib/quote-pdf";
import { sendMail } from "@/lib/azure-mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  }
  if (!quote.paidAt) {
    return NextResponse.json(
      { ok: false, error: "El presupuesto aún no está pagado; no se puede enviar el recibo." },
      { status: 400 }
    );
  }

  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  const buffer = buildQuotePdfBuffer({
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
    payUrl: `${baseUrl}/q/${quote.publicToken}`,
    lines: quote.lines.map((line) => ({
      description: line.description,
      quantity: decimalToNumber(line.quantity),
      unitPrice: decimalToNumber(line.unitPrice),
      lineTotal: decimalToNumber(line.lineTotal),
    })),
    isDraft: false,
    paid: true,
    notesLegal: quote.notesLegal,
    deliveryTerm: quote.deliveryTerm,
    holderNames: quote.holderNames,
    paymentMethods: quote.paymentMethods,
    contactWhatsapp: quote.contactWhatsapp,
    lang: quote.pdfLang,
  });

  const firstName = (quote.customerName || "").trim().split(/\s+/)[0] || "";
  const subject = `Recibo de pago — Presupuesto ${quote.quoteNumber}`;
  const body =
    `Hola ${firstName}:\n\n` +
    `Hemos recibido tu pago. Adjuntamos el presupuesto ${quote.quoteNumber} sellado como PAGADO ` +
    `como justificante. Comenzamos con tu traducción jurada y te avisaremos cuando esté lista.\n\n` +
    `Gracias por confiar en nosotros.`;

  try {
    await sendMail({
      to: quote.customerEmail,
      subject,
      html: renderSimpleEmailHtml(body),
      attachments: [
        {
          name: `recibo-${quote.quoteNumber}.pdf`,
          contentType: "application/pdf",
          contentBytes: buffer.toString("base64"),
        },
      ],
    });

    await prisma.messageLog.create({
      data: {
        quoteId: quote.id,
        channel: "EMAIL",
        type: "PAID_CONFIRMATION",
        recipient: quote.customerEmail,
        subject,
        body: "Recibo PAGADO enviado al cliente (PDF adjunto).",
        sentAt: new Date(),
        status: "SENT",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[quotes:send-paid-receipt] error", err?.message || err);
    return NextResponse.json({ ok: false, error: "No se pudo enviar el recibo." }, { status: 500 });
  }
}
