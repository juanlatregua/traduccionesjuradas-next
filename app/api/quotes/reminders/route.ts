import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { buildExpiredEmail, buildWhatsAppReminderText } from "@/lib/quote-messages";
import { sendQuoteEmailWithRetry, isPlaceholderEmail, phoneFromPlaceholder } from "@/lib/quote-email";
import { sendStaffAlertSMS, sendClientNotification, formatPhoneSpain } from "@/lib/sms";
import { smsPresupuestoCaducado } from "@/lib/sms-templates";
import { buildQuotePostMortem } from "@/lib/quote-post-mortem";
import { alreadyCustomerFor, countSkip, loadCustomerIndex } from "@/lib/client-contact-guard";
import { buildCierreReminder, decideReminder, REMINDER_AFTER_HOURS } from "@/lib/cierre-math";
import { deduceLostReasonFor } from "@/lib/cierre";

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
  // Cierre (Juan, 8-oct-2026): UN solo recordatorio, a las 24 h del envío y solo a quien
  // no ha abierto el presupuesto (apertura humana). Nada de insistir a quien ya lo vio.
  const threshold = new Date(now.getTime() - REMINDER_AFTER_HOURS * 60 * 60 * 1000);
  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");

  let remindersSent = 0;
  let remindersFailed = 0;
  let remindersOpened = 0; // abiertos por una persona: sin recordatorio
  let whatsappTasks = 0; // solo-WhatsApp sin abrir: lo gestiona el vigía, no se les escribe desde aquí
  let lostAuto = 0; // caducados con motivo deducido
  let expiredUpdated = 0;
  let expiredFailed = 0;
  const failedQuotes: string[] = [];
  const skippedClients: Record<string, number> = {}; // ya pagó / ya es cliente: no se le escribe
  let smsSkipped = 0; // CLIENT_SMS=off o número con 2+ SMS FAILED en 7 días

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
      accessEvents: { select: { userAgent: true } },
      // Solo un recordatorio ENVIADO cuenta como hecho: los borradores WHATSAPP
      // que dejaba el cron para "envío manual" nunca salían (auditoría 24-ago:
      // 0 WhatsApp SENT en toda la tabla) y aun así bloqueaban el reproceso.
      messageLogs: {
        where: {
          type: "REMINDER",
          // SKIPPED = recordatorio omitido por ser ya cliente (no cuenta como toque en el vigía).
          status: { in: ["SENT", "SKIPPED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 200,
  });

  const expirable = await prisma.quote.findMany({
    where: {
      status: {
        in: ["DRAFT", "SENT", "OPENED", "ACCEPTED"],
      },
      paidAt: null,
      validUntil: {
        lt: now,
      },
      // Un presupuesto que YA tiene pedido no caduca: es el carril de crédito
      // (se trabaja y entrega antes de cobrar; el Quote se queda ACCEPTED a
      // propósito para que el enlace de pago siga vivo hasta el vencimiento).
      orders: { none: {} },
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


  // Guarda común: UN índice por ejecución para recordatorios y caducidades.
  const sentDates = [...candidates.map((q) => q.sentAt ?? q.createdAt), ...expirable.map((q) => q.sentAt ?? q.createdAt)];
  const index = sentDates.length
    ? await loadCustomerIndex({
        since: new Date(Math.min(...sentDates.map((d) => d.getTime()))),
        emails: [...candidates, ...expirable].map((q) => q.customerEmail),
        expedienteRefs: [...candidates, ...expirable].map((q) => q.expedienteRef || ""),
      })
    : null;
  const yaCliente = (q: (typeof candidates)[number] | (typeof expirable)[number]) =>
    index
      ? alreadyCustomerFor(
          { mode: "encargo", expedienteRef: q.expedienteRef, quoteId: q.id, at: q.sentAt ?? q.createdAt },
          { index },
        )
      : ({ skip: false } as const);

  for (const quote of candidates) {
    if (quote.messageLogs.length > 0) continue;
    const ya = yaCliente(quote);
    if (ya.skip) {
      countSkip(skippedClients, ya.reason);
      await prisma.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: isPlaceholderEmail(quote.customerEmail) ? "SMS" : "EMAIL",
          type: "REMINDER",
          recipient: quote.customerEmail,
          body: `[omitido: ya es cliente — ${ya.reason} ${ya.ref}]`,
          status: "SKIPPED",
        },
      });
      continue;
    }
    const payUrl = `${baseUrl}/q/${quote.publicToken}`;

    const decision = decideReminder({
      status: quote.status,
      sentAt: quote.sentAt,
      now,
      events: quote.accessEvents,
      openedAt: quote.openedAt,
      customerEmail: quote.customerEmail,
      alreadyReminded: false, // el filtro de messageLogs de arriba ya descartó los recordados
    });
    if (decision === "none") {
      remindersOpened += 1;
      continue;
    }
    // Solo-WhatsApp (@whatsapp.local): no se le escribe por email; aparece en el vigía como
    // «WhatsApp a X: no ha abierto el presupuesto» con el texto listo (lib/vigia.ts).
    if (decision === "whatsapp_task") {
      whatsappTasks += 1;
      continue;
    }

    const waText = buildWhatsAppReminderText({
      name: quote.customerName || "cliente",
      payUrl,
    });
    // Corto y en el idioma del presupuesto, con el enlace /q y el de pago con tarjeta.
    const msg = buildCierreReminder({
      lang: quote.pdfLang,
      name: quote.customerName || "",
      quoteNumber: quote.quoteNumber,
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

    // Motivo deducido (lib/cierre.ts): sustituido / no abierto. Lo abierto sin pago se queda
    // sin motivo y sale como tarea en el vigía. Best-effort: no impide el aviso.
    if (quote.sentAt) {
      try {
        if (await deduceLostReasonFor(quote.id)) lostAuto += 1;
      } catch (err) {
        console.error("[quotes:reminders] lost reason deduction failed", quote.quoteNumber, err);
      }
    }

    const payUrl = `${baseUrl}/q/${quote.publicToken}`;

    const yaExp = yaCliente(quote);
    if (yaExp.skip) {
      countSkip(skippedClients, yaExp.reason);
      continue;
    }

    // Lead solo-WhatsApp: aviso de caducidad por SMS con el enlace a /q (allí
    // puede retomar o dejar el motivo — medida 2 del funnel 24-ago: hasta hoy
    // morían mudos, lostReason siempre null). Solo si ABRIÓ el presupuesto:
    // un "ha caducado" como primer contacto no tiene sentido.
    if (isPlaceholderEmail(quote.customerEmail)) {
      const phone = (quote.customerPhone || "").trim() || phoneFromPlaceholder(quote.customerEmail);
      if (!phone || !quote.openedAt) continue;
      const smsBody = smsPresupuestoCaducado({ ref: quote.quoteNumber, url: payUrl });
      const sent = await sendClientNotification({ to: formatPhoneSpain(phone), body: smsBody }).catch(
        (err) => ({ ok: false as const, error: String(err) })
      );
      if ("skipped" in sent && sent.skipped) { smsSkipped += 1; continue; }
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
    remindersOpened,
    whatsappTasks,
    lostAuto,
    smsSkipped,
    skippedClients,
    expiredUpdated,
    expiredFailed,
    scanned: candidates.length,
    expirable: expirable.length,
  });
}

export const POST = GET;
