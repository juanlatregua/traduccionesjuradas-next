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
import { fetchFileAsAttachment, buildIssuedInvoiceAttachment } from "@/lib/delivery-attachments";
import type { MailAttachment } from "@/lib/azure-mail";

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
    // manual=true: el staff ya lo ha enviado desde su WhatsApp (wa.me); aqui
    // solo se registra la respuesta y el hilo queda cerrado.
    const manual = Boolean(payload?.manual);

    // Traducciones entregadas + factura emitida, adjuntas por defecto cuando el
    // hilo está casado con un pedido que ya tiene entrega (caso Maider 27-ago:
    // la respuesta salía sin los PDF). attachFiles=false lo desactiva.
    const attachFiles = payload?.attachFiles !== false;
    let attachments: MailAttachment[] = [];
    let orderRefForFiles = inbound.orderReference;
    if (!orderRefForFiles && inbound.quoteId) {
      const o = await prisma.order.findFirst({ where: { quoteId: inbound.quoteId }, select: { reference: true } });
      orderRefForFiles = o?.reference ?? null;
    }
    if (!isWhatsApp && attachFiles && orderRefForFiles) {
      const order = await prisma.order.findUnique({
        where: { reference: orderRefForFiles },
        select: { reference: true, deliveryFilesJson: true, translatedFileUrl: true, finalFilename: true },
      });
      if (order) {
        const files: { url: string; filename?: string | null }[] = Array.isArray(order.deliveryFilesJson)
          ? (order.deliveryFilesJson as unknown as { url: string; filename?: string | null }[]).filter(
              (f) => f && typeof f.url === "string" && f.url.trim()
            )
          : order.translatedFileUrl
            ? [{ url: order.translatedFileUrl, filename: order.finalFilename || null }]
            : [];
        const multi = files.length > 1;
        const [fileAtts, invAtt] = await Promise.all([
          Promise.all(
            files.map((f, i) =>
              fetchFileAsAttachment(f.url, f.filename || `Traduccion-jurada-${order.reference}${multi ? `-${i + 1}` : ""}.pdf`)
            )
          ),
          buildIssuedInvoiceAttachment(order.reference),
        ]);
        attachments = [...(fileAtts.filter(Boolean) as MailAttachment[]), ...(invAtt ? [invAtt] : [])];
      }
    }

    if (isWhatsApp && manual) {
      /* sin envio */
    } else if (isWhatsApp) {
      if (!inbound.fromPhone) {
        return NextResponse.json({ ok: false, error: "El mensaje no tiene teléfono de origen." }, { status: 400 });
      }
      await sendWhatsAppInboxReply(inbound.fromPhone, bodyText);
    } else {
      await replyToInboxMessage(inbound.graphId, {
        html: renderClientMessageHtml(bodyText),
        subject,
        attachments,
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
        repliedBy: manual ? `${access.email} (WhatsApp manual)` : access.email,
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
                fileCount: attachments.length,
                actorEmail: access.email,
                inboundEmailId: inbound.id,
              },
            },
          })
          .catch((e) => console.error("[inbox:reply] orderEvent failed", e));
      }
    }

    return NextResponse.json({ ok: true, fileCount: attachments.length });
  } catch (err: any) {
    console.error("[inbox:reply] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo enviar la respuesta." },
      { status: 500 }
    );
  }
}
