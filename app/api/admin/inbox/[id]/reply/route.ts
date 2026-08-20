// Envía la respuesta a un email entrante desde el buzón del negocio,
// manteniendo el hilo (Graph /reply). Registra la respuesta en InboundEmail y,
// si el email está casado con presupuesto/pedido, también en su historial
// (MessageLog INBOX_REPLY / OrderEvent), como el resto de mensajes al cliente.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { replyToInboxMessage } from "@/lib/azure-mail-read";
import { renderClientMessageHtml } from "@/lib/email";
import { sendWhatsAppInboxReply } from "@/lib/whatsapp-inbox";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  try {
    const inbound = await prisma.inboundEmail.findUnique({ where: { id: params.id } });
    if (!inbound) {
      return NextResponse.json({ ok: false, error: "Email no encontrado." }, { status: 404 });
    }

    const payload = await req.json().catch(() => ({}));
    const bodyText = String(payload?.body || "").trim();
    const subject = String(payload?.subject || "").trim() || `RE: ${inbound.subject}`;
    if (!bodyText) {
      return NextResponse.json({ ok: false, error: "El mensaje está vacío." }, { status: 400 });
    }
    if (bodyText.length > 8000) {
      return NextResponse.json(
        { ok: false, error: "El mensaje es demasiado largo (máx. 8000)." },
        { status: 400 }
      );
    }

    const isWhatsApp = inbound.channel === "WHATSAPP";
    if (isWhatsApp) {
      if (!inbound.fromPhone) {
        return NextResponse.json({ ok: false, error: "El mensaje no tiene teléfono de origen." }, { status: 400 });
      }
      await sendWhatsAppInboxReply(inbound.fromPhone, bodyText);
    } else {
      await replyToInboxMessage(inbound.graphId, {
        html: renderClientMessageHtml(bodyText),
        subject,
      });
    }

    const now = new Date();
    await prisma.inboundEmail.update({
      where: { id: inbound.id },
      data: {
        status: "REPLIED",
        replySubject: subject,
        replyBody: bodyText,
        repliedAt: now,
        repliedBy: access.email,
      },
    });

    if (inbound.quoteId) {
      await prisma.messageLog
        .create({
          data: {
            quoteId: inbound.quoteId,
            channel: isWhatsApp ? "WHATSAPP" : "EMAIL",
            type: "INBOX_REPLY",
            recipient: isWhatsApp ? inbound.fromPhone || inbound.fromEmail : inbound.fromEmail,
            subject,
            body: bodyText,
            sentAt: now,
            status: "SENT",
          },
        })
        .catch((e) => console.error("[inbox:reply] messageLog failed", e));
    }

    if (inbound.orderReference) {
      const order = await prisma.order.findUnique({
        where: { reference: inbound.orderReference },
        select: { id: true },
      });
      if (order) {
        await prisma.orderEvent
          .create({
            data: {
              orderId: order.id,
              type: "notification.inbox_reply.sent",
              message: "Respuesta enviada al cliente desde la bandeja de entrada.",
              payload: {
                channel: isWhatsApp ? "WHATSAPP" : "EMAIL",
                toEmail: inbound.fromEmail,
                toPhone: inbound.fromPhone,
                subject,
                bodyText,
                actorEmail: access.email,
                inboundEmailId: inbound.id,
              },
            },
          })
          .catch((e) => console.error("[inbox:reply] orderEvent failed", e));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[inbox:reply] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo enviar la respuesta." },
      { status: 500 }
    );
  }
}
