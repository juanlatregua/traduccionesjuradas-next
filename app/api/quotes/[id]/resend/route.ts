import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { buildPayLinkEmail, buildWhatsAppPayText } from "@/lib/quote-messages";
import { sendQuoteEmailWithRetry, isPlaceholderEmail } from "@/lib/quote-email";
import { buildAndUploadFinalQuotePdf, MAX_EMAIL_ATTACH_BYTES } from "@/lib/quote-send";

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
      include: { lines: { orderBy: { createdAt: "asc" } } },
    });
    if (!quote) {
      return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
    }

    const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
    // Siempre /q: cobra el total vivo del presupuesto; el amountCents de un pedido
    // enlazado no sigue a las ediciones del PATCH.
    const payUrl = `${baseUrl}/q/${quote.publicToken}`;

    // Las líneas de un SENT/OPENED/ACCEPTED se pueden editar después de enviar:
    // sin regenerar, /q y el adjunto enseñaban el PDF viejo con el total nuevo.
    let pdfBuffer: Buffer | null = null;
    if (["SENT", "OPENED", "ACCEPTED"].includes(quote.status)) {
      const pdf = await buildAndUploadFinalQuotePdf(quote, payUrl);
      await prisma.quote.update({ where: { id: quote.id }, data: { pdfUrl: pdf.pdfUrl, pdfHash: pdf.pdfHash } });
      pdfBuffer = pdf.pdfBuffer;
    }
    const plazoMatch = quote.notesLegal?.match(/Plazo de entrega:\s*([^.]+)/);
    const msgData = {
      name: quote.customerName || "cliente",
      payUrl,
      lang: quote.pdfLang,
      totalEur: Number(quote.total),
      deliveryTerm: quote.deliveryTerm || (plazoMatch ? plazoMatch[1].trim() : null),
      deliveryType: quote.deliveryType,
      vatExempt: Number(quote.vatRate) <= 0,
      translatorName: quote.translatorName,
      translatorMaec: quote.translatorMaec,
    };
    const msg = buildPayLinkEmail(msgData);
    // Guardia anti-Graph: si el email es un marcador de WhatsApp (no entregable),
    // NO intentamos enviar (antes esto provocaba un 500). Se devuelve el texto de
    // WhatsApp para que el staff lo envíe a mano.
    const placeholder = isPlaceholderEmail(quote.customerEmail);
    let providerId: string | null = null;
    if (!placeholder) {
      const sendResult = await sendQuoteEmailWithRetry({
        to: quote.customerEmail,
        subject: msg.subject,
        body: msg.body,
        attachments:
          pdfBuffer && pdfBuffer.length <= MAX_EMAIL_ATTACH_BYTES
            ? [{ name: `Presupuesto-${quote.quoteNumber}.pdf`, contentType: "application/pdf", contentBytes: pdfBuffer.toString("base64") }]
            : [],
      });
      providerId = sendResult.providerId;
    }
    const whatsappText = buildWhatsAppPayText(msgData);

    if (!placeholder) {
      await prisma.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: "EMAIL",
          type: "RESEND_PAY_LINK",
          recipient: quote.customerEmail,
          subject: msg.subject,
          body: msg.body,
          sentAt: new Date(),
          providerId,
          status: "SENT",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      payUrl,
      whatsappText,
      emailSent: !placeholder,
    });
  } catch (err: any) {
    console.error("[quotes:resend] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo reenviar el email." },
      { status: 500 }
    );
  }
}
