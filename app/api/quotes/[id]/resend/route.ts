import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { buildPayLinkEmail, buildWhatsAppPayText } from "@/lib/quote-messages";
import { sendQuoteEmailWithRetry, isPlaceholderEmail } from "@/lib/quote-email";

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
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        publicToken: true,
        total: true,
        vatRate: true,
        deliveryType: true,
        notesLegal: true,
        paymentMethods: true,
        sourceLang: true,
        targetLang: true,
      },
    });
    if (!quote) {
      return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
    }

    const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
    const payUrl = `${baseUrl}/q/${quote.publicToken}`;
    const msg = buildPayLinkEmail({
      name: quote.customerName || "cliente",
      payUrl,
    });
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
      });
      providerId = sendResult.providerId;
    }
    const plazoMatch = quote.notesLegal?.match(/Plazo de entrega:\s*([^.]+)/);
    const whatsappText = buildWhatsAppPayText({
      name: quote.customerName || "cliente",
      totalEur: Number(quote.total),
      deliveryType: quote.deliveryType,
      plazo: plazoMatch ? plazoMatch[1].trim() : null,
      paymentMethods: quote.paymentMethods,
      sourceLang: quote.sourceLang,
      targetLang: quote.targetLang,
      payUrl,
      vatNote:
        Number(quote.vatRate) > 0
          ? undefined
          : "operación no sujeta a IVA — residente fuera de la UE",
    });

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
