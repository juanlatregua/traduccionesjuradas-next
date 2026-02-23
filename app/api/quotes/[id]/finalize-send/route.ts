import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { decimalToNumber } from "@/lib/quotes";
import { buildQuotePdfBuffer, hashPdf, uploadFinalQuotePdf } from "@/lib/quote-pdf";
import { buildPayLinkEmail, buildWhatsAppPayText } from "@/lib/quote-messages";
import { sendQuoteEmail } from "@/lib/quote-email";

export const runtime = "nodejs";

type Params = {
  params: {
    id: string;
  };
};

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      include: {
        lines: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!quote) {
      return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
    }

    if (["PAID", "IN_PROGRESS", "DELIVERED", "EXPIRED"].includes(quote.status)) {
      return NextResponse.json(
        { ok: false, error: `No se puede enviar en estado ${quote.status}.` },
        { status: 400 }
      );
    }

    const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
    const payUrl = `${baseUrl}/q/${quote.publicToken}`;

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
    });

    const [pdfUrl, pdfHash] = await Promise.all([
      uploadFinalQuotePdf({
        quoteNumber: quote.quoteNumber,
        buffer: pdfBuffer,
      }),
      Promise.resolve(hashPdf(pdfBuffer)),
    ]);

    const emailCopy = buildPayLinkEmail({
      name: quote.customerName || "cliente",
      payUrl,
    });
    const sendResult = await sendQuoteEmail({
      to: quote.customerEmail,
      subject: emailCopy.subject,
      body: emailCopy.body,
    });

    const whatsappBody = buildWhatsAppPayText({
      name: quote.customerName || "cliente",
      payUrl,
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
          adminSentBy: access.email,
        },
      });

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

    return NextResponse.json({
      ok: true,
      pdfUrl,
      payUrl,
      whatsappText: whatsappBody,
    });
  } catch (err: any) {
    console.error("[quotes:finalize-send] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo finalizar y enviar el presupuesto." },
      { status: 500 }
    );
  }
}
