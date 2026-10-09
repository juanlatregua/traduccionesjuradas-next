import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import {
  buildPayLinkEmail,
  buildReminderEmail,
  buildPaidDigitalEmail,
  buildPaidPaperEmail,
} from "@/lib/quote-messages";
import { previewQuoteEmail } from "@/lib/quote-email";
import { calculateEtaDate } from "@/lib/quotes";

export const runtime = "nodejs";

type Params = {
  params: {
    id: string;
  };
};

export async function GET(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      quoteNumber: true,
      customerName: true,
      publicToken: true,
      sentAt: true,
      deliveryType: true,
      translatorName: true,
      translatorMaec: true,
      paymentMethods: true,
      pdfLang: true,
      total: true,
      deliveryTerm: true,
      vatRate: true,
    },
  });
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  }

  const url = new URL(req.url);
  const template = String(url.searchParams.get("template") || "PAY_LINK").toUpperCase();
  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  const payUrl = `${baseUrl}/q/${quote.publicToken}`;
  const name = quote.customerName || "cliente";

  let subject = "";
  let body = "";

  if (template === "REMINDER") {
    const msg = buildReminderEmail({
      name,
      quoteNumber: quote.quoteNumber,
      sentDate: quote.sentAt || new Date(),
      payUrl,
    });
    subject = msg.subject;
    body = msg.body;
  } else if (template === "PAID_CONFIRMATION") {
    const etaDate = calculateEtaDate({
      deliveryType: quote.deliveryType,
    });
    const msg =
      quote.deliveryType === "PAPER_SHIP"
        ? buildPaidPaperEmail({ name, etaDate, quoteNumber: quote.quoteNumber, trackUrl: payUrl, lang: quote.pdfLang })
        : buildPaidDigitalEmail({ name, etaDate, quoteNumber: quote.quoteNumber, trackUrl: payUrl, lang: quote.pdfLang });
    subject = msg.subject;
    body = msg.body;
  } else {
    const msg = buildPayLinkEmail({
      name,
      payUrl,
      lang: quote.pdfLang,
      totalEur: Number(quote.total),
      deliveryTerm: quote.deliveryTerm,
      deliveryType: quote.deliveryType,
      vatExempt: Number(quote.vatRate) <= 0,
      translatorName: quote.translatorName,
      translatorMaec: quote.translatorMaec,
    });
    subject = msg.subject;
    body = msg.body;
  }

  const preview = previewQuoteEmail({ subject, body });
  return NextResponse.json({
    ok: true,
    template,
    preview,
  });
}
