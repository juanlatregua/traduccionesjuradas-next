import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import {
  buildExpiredEmail,
  buildReminderEmail,
  buildWhatsAppReminderText,
} from "@/lib/quote-messages";
import { sendQuoteEmailWithRetry, isPlaceholderEmail } from "@/lib/quote-email";
import { sendStaffAlertSMS } from "@/lib/sms";

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
  let remindersWhatsapp = 0; // leads @whatsapp.local: no email, borrador para envío manual
  let expiredUpdated = 0;
  let expiredFailed = 0;
  const failedQuotes: string[] = [];
  const whatsappPending: string[] = [];

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
      messageLogs: {
        where: {
          type: "REMINDER",
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

    // Lead de WhatsApp (email no entregable): no se intenta email. Se deja un
    // borrador de WhatsApp para envío manual y se cuenta como REMINDER (para no
    // reprocesarlo cada día). Se avisa al staff al final.
    if (isPlaceholderEmail(quote.customerEmail)) {
      await prisma.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: "WHATSAPP",
          type: "REMINDER",
          recipient: quote.customerPhone || quote.customerEmail,
          body: waText,
          status: "DRAFT",
        },
      });
      remindersWhatsapp += 1;
      whatsappPending.push(quote.quoteNumber);
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
      },
    });
    expiredUpdated += 1;

    const wasDelivered = quote.messageLogs.length > 0 && !isPlaceholderEmail(quote.customerEmail);
    if (!wasDelivered) continue;

    const payUrl = `${baseUrl}/q/${quote.publicToken}`;
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

  // Aviso al staff: lo que requiere acción manual (envíos fallidos + leads de
  // WhatsApp que esperan un recordatorio a mano). Best-effort, no bloquea.
  if (remindersFailed > 0 || expiredFailed > 0 || remindersWhatsapp > 0) {
    const parts: string[] = [];
    if (remindersFailed + expiredFailed > 0) {
      parts.push(`${remindersFailed + expiredFailed} envío(s) fallido(s) [${failedQuotes.join(", ")}]`);
    }
    if (remindersWhatsapp > 0) {
      parts.push(`${remindersWhatsapp} lead(s) WhatsApp pendiente(s) de recordatorio manual [${whatsappPending.join(", ")}]`);
    }
    await sendStaffAlertSMS(
      `TraduccionesJuradas (cron presupuestos): ${parts.join("; ")}.`,
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
