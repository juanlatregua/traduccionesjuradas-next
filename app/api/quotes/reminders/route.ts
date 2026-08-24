import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import {
  buildExpiredEmail,
  buildReminderEmail,
  buildWhatsAppReminderText,
} from "@/lib/quote-messages";
import { sendQuoteEmailWithRetry, isPlaceholderEmail, phoneFromPlaceholder } from "@/lib/quote-email";
import { sendStaffAlertSMS, sendNotification, formatPhoneSpain } from "@/lib/sms";
import { smsRecordatorioPago, smsPresupuestoCaducado } from "@/lib/sms-templates";
import { buildQuotePostMortem } from "@/lib/quote-post-mortem";

export const runtime = "nodejs";

function hasCronAuth(req: Request) {
  const secret = process.env.QUOTES_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization") || "";
  return header === secret || header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!hasCronAuth(req)) {
    const access = await requireStaffAccess(req);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
    }
  }

  const now = new Date();
  const threshold = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");

  let remindersSent = 0;
  let remindersFailed = 0;
  let remindersWhatsapp = 0; // leads @whatsapp.local: recordatorio enviado por SMS
  let expiredUpdated = 0;
  let expiredFailed = 0;
  const failedQuotes: string[] = [];

  const candidates = await prisma.quote.findMany({
    where: {
      status: {
        in: ["SENT", "OPENED"],
      },
      sentAt: {
        lte: threshold,
      },
      paidAt: null,
      validUntil: {
        gt: now,
      },
    },
    include: {
      // Solo un recordatorio ENVIADO cuenta como hecho: los borradores WHATSAPP
      // que dejaba el cron para "envío manual" nunca salían (auditoría 24-ago:
      // 0 WhatsApp SENT en toda la tabla) y aun así bloqueaban el reproceso.
      messageLogs: {
        where: {
          type: "REMINDER",
          status: "SENT",
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 200,
  });

  for (const quote of candidates) {
    if (quote.messageLogs.length > 0) continue;
    const payUrl = `${baseUrl}/q/${quote.publicToken}`;
    const waText = buildWhatsAppReminderText({
      name: quote.customerName || "cliente",
      payUrl,
    });

    // Lead de WhatsApp (email no entregable): recordatorio por SMS al número del
    // cliente (medida 1 de la auditoría del funnel 24-ago: ~2.600 € expirados sin
    // un solo recordatorio entregado — el borrador "para envío manual" no salía
    // nunca). Si el SMS falla (p. ej. país sin permiso en Twilio) queda FAILED y
    // se reintenta mañana + aviso a staff.
    if (isPlaceholderEmail(quote.customerEmail)) {
      const phone = (quote.customerPhone || "").trim() || phoneFromPlaceholder(quote.customerEmail);
      if (!phone) continue;
      const smsBody = smsRecordatorioPago({
        ref: quote.quoteNumber,
        precio: Number(quote.total).toFixed(2),
        url: payUrl,
      });
      const sent = await sendNotification({ to: formatPhoneSpain(phone), body: smsBody }).catch(
        (err) => ({ ok: false as const, error: String(err) })
      );
      await prisma.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: "SMS",
          type: "REMINDER",
          recipient: phone,
          body: sent.ok ? smsBody : `${smsBody}\n\n[ERROR]: ${("error" in sent && sent.error) || "unknown"}`,
          sentAt: sent.ok ? new Date() : null,
          status: sent.ok ? "SENT" : "FAILED",
        },
      });
      if (sent.ok) {
        remindersWhatsapp += 1;
      } else {
        remindersFailed += 1;
        failedQuotes.push(quote.quoteNumber);
      }
      continue;
    }

    const msg = buildReminderEmail({
      name: quote.customerName || "cliente",
      quoteNumber: quote.quoteNumber,
      sentDate: quote.sentAt || quote.createdAt,
      payUrl,
    });

    try {
      const sent = await sendQuoteEmailWithRetry({
        to: quote.customerEmail,
        subject: msg.subject,
        body: msg.body,
      });
      await prisma.messageLog.createMany({
        data: [
          {
            quoteId: quote.id,
            channel: "EMAIL",
            type: "REMINDER",
            recipient: quote.customerEmail,
            subject: msg.subject,
            body: msg.body,
            sentAt: new Date(),
            providerId: sent.providerId,
            status: "SENT",
          },
          {
            quoteId: quote.id,
            channel: "WHATSAPP",
            type: "DRAFT_WHATSAPP",
            recipient: quote.customerPhone || quote.customerEmail,
            body: waText,
            status: "DRAFT",
          },
        ],
      });
      remindersSent += 1;
    } catch (err: any) {
      remindersFailed += 1;
      failedQuotes.push(quote.quoteNumber);
      await prisma.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: "EMAIL",
          type: "REMINDER",
          recipient: quote.customerEmail,
          subject: msg.subject,
          body: `${msg.body}\n\n[ERROR]: ${String(err?.message || err || "unknown")}`,
          status: "FAILED",
        },
      });
    }
  }

  const expirable = await prisma.quote.findMany({
    where: {
      status: {
        in: ["DRAFT", "SENT", "OPENED", "ACCEPTED"],
      },
      paidAt: null,
      validUntil: {
        lt: now,
      },
    },
    include: {
      // ¿Se entregó realmente al cliente alguna vez? (para no enviar un aviso de
      // "expirado" referenciando un presupuesto que el cliente NUNCA recibió).
      messageLogs: {
        where: {
          channel: "EMAIL",
          status: "SENT",
          type: { in: ["PAY_LINK", "RESEND_PAY_LINK", "REMINDER"] },
        },
        take: 1,
      },
    },
    take: 200,
  });

  for (const quote of expirable) {
    // Siempre se marca EXPIRED (la validez caducó). El email de aviso solo se manda
    // si el presupuesto se entregó de verdad y el email es entregable: un DRAFT
    // nunca enviado o un lead @whatsapp.local NO debe recibir un "presupuesto
    // expirado" como primer y único contacto.
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: "EXPIRED",
        expiredAt: now,
      },
    });
    expiredUpdated += 1;

    // Post-mortem determinista (una sola vez, en el instante de expirar): el
    // digest diario lo lee de Quote.postMortemJson. Best-effort: un fallo aquí
    // no debe impedir marcar EXPIRED ni enviar el aviso.
    try {
      const postMortem = await buildQuotePostMortem(quote.id);
      if (postMortem) {
        await prisma.quote.update({
          where: { id: quote.id },
          data: { postMortemJson: postMortem },
        });
      }
    } catch (err) {
      console.error("[quotes:reminders] post-mortem failed", quote.quoteNumber, err);
    }

    const payUrl = `${baseUrl}/q/${quote.publicToken}`;

    // Lead solo-WhatsApp: aviso de caducidad por SMS con el enlace a /q (allí
    // puede retomar o dejar el motivo — medida 2 del funnel 24-ago: hasta hoy
    // morían mudos, lostReason siempre null). Solo si ABRIÓ el presupuesto:
    // un "ha caducado" como primer contacto no tiene sentido.
    if (isPlaceholderEmail(quote.customerEmail)) {
      const phone = (quote.customerPhone || "").trim() || phoneFromPlaceholder(quote.customerEmail);
      if (!phone || !quote.openedAt) continue;
      const smsBody = smsPresupuestoCaducado({ ref: quote.quoteNumber, url: payUrl });
      const sent = await sendNotification({ to: formatPhoneSpain(phone), body: smsBody }).catch(
        (err) => ({ ok: false as const, error: String(err) })
      );
      await prisma.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: "SMS",
          type: "EXPIRED_NOTICE",
          recipient: phone,
          body: sent.ok ? smsBody : `${smsBody}\n\n[ERROR]: ${("error" in sent && sent.error) || "unknown"}`,
          sentAt: sent.ok ? new Date() : null,
          status: sent.ok ? "SENT" : "FAILED",
        },
      });
      if (!sent.ok) {
        expiredFailed += 1;
        failedQuotes.push(quote.quoteNumber);
      }
      continue;
    }

    const wasDelivered = quote.messageLogs.length > 0;
    if (!wasDelivered) continue;
    const expired = buildExpiredEmail({
      name: quote.customerName || "cliente",
      quoteNumber: quote.quoteNumber,
      payUrl,
    });

    try {
      const sent = await sendQuoteEmailWithRetry({
        to: quote.customerEmail,
        subject: expired.subject,
        body: expired.body,
      });
      await prisma.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: "EMAIL",
          type: "EXPIRED_NOTICE",
          recipient: quote.customerEmail,
          subject: expired.subject,
          body: expired.body,
          sentAt: new Date(),
          providerId: sent.providerId,
          status: "SENT",
        },
      });
    } catch (err: any) {
      expiredFailed += 1;
      failedQuotes.push(quote.quoteNumber);
      await prisma.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: "EMAIL",
          type: "EXPIRED_NOTICE",
          recipient: quote.customerEmail,
          subject: expired.subject,
          body: `${expired.body}\n\n[ERROR]: ${String(err?.message || err || "unknown")}`,
          status: "FAILED",
        },
      });
    }
  }

  // Aviso al staff solo con fallos (los recordatorios a leads WhatsApp ya salen
  // solos por SMS). Best-effort, no bloquea.
  if (remindersFailed > 0 || expiredFailed > 0) {
    await sendStaffAlertSMS(
      `TraduccionesJuradas (cron presupuestos): ${remindersFailed + expiredFailed} envío(s) fallido(s) [${failedQuotes.join(", ")}].`,
      "quotes_reminders"
    ).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    remindersSent,
    remindersFailed,
    remindersWhatsapp,
    expiredUpdated,
    expiredFailed,
    scanned: candidates.length,
    expirable: expirable.length,
  });
}

export const POST = GET;
