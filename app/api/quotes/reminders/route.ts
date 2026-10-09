import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { buildExpiredEmail, buildWhatsAppReminderText } from "@/lib/quote-messages";
import { sendQuoteEmailWithRetry, isPlaceholderEmail, phoneFromPlaceholder } from "@/lib/quote-email";
import { sendStaffAlertSMS, sendClientNotification, formatPhoneSpain } from "@/lib/sms";
import { smsPresupuestoCaducado } from "@/lib/sms-templates";
import { buildQuotePostMortem } from "@/lib/quote-post-mortem";
import { alreadyCustomerFor, countSkip, loadCustomerIndex } from "@/lib/client-contact-guard";
import { buildCierreReminder, decideFollowUp, NO_RESPONSE_NOTE, REMINDER_AFTER_HOURS } from "@/lib/cierre-math";
import { deduceLostReasonFor } from "@/lib/cierre";
import { createReplyChecker } from "@/lib/respuesta-guard-db";
import { replyGate } from "@/lib/respuesta-guard";
import { sendMail } from "@/lib/azure-mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";

const REPLIED_MARK = "cierre:cliente_contesto";

export const runtime = "nodejs";

function hasCronAuth(req: Request) {
  const secret = process.env.QUOTES_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret") || req.headers.get("authorization") || "";
  return header === secret || header === `Bearer ${secret}`;
}

// Aviso a Juan por dos canales (email + SMS) una sola vez por contacto; el rastro es un MessageLog.
async function notifyClientReplied(
  quote: { id: string; quoteNumber: string; customerEmail: string; customerName: string | null },
  lastContact: Date,
  baseUrl: string,
  action: string,
) {
  try {
    const dup = await prisma.messageLog.findFirst({ where: { quoteId: quote.id, subject: REPLIED_MARK, createdAt: { gte: lastContact } }, select: { id: true } });
    if (dup) return;
    const url = `${baseUrl}/zona-traductor/presupuestos/${quote.id}`;
    const what = action === "close" ? "no se ha cerrado" : "no se le ha recordado";
    const text = `El cliente contestó después del último contacto del presupuesto ${quote.quoteNumber} (${quote.customerName || quote.customerEmail}): ${what}. Revisa su respuesta en el buzón: ${url}`;
    await prisma.messageLog.create({ data: { quoteId: quote.id, channel: "EMAIL", type: "INBOX_REPLY", recipient: "staff", subject: REPLIED_MARK, body: text, status: "NOTICE" } });
    await sendMail({
      to: process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net",
      subject: `El cliente contestó: revisa ${quote.quoteNumber}`,
      text,
      html: renderSimpleEmailHtml(text),
    }).catch((err) => console.error("[quotes:reminders] aviso email fallo", err));
    await sendStaffAlertSMS(`Cliente contesto (${quote.quoteNumber}): ${what}. Revisa: ${url}`, `cliente_contesto ${quote.quoteNumber}`).catch(() => {});
  } catch (err) {
    console.error("[quotes:reminders] aviso respuesta falló", quote.quoteNumber, err);
  }
}

export async function GET(req: Request) {
  if (!hasCronAuth(req)) {
    const access = await requireStaffAccess(req);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
    }
  }

  const now = new Date();
  // Cierre (Juan, 9-oct-2026): «2º contacto a las 24 h; si no responde, adiós». A las 24 h del
  // envío TODO presupuesto sin pagar (SENT/OPENED/ACCEPTED) recibe UN segundo contacto (texto
  // distinto si lo abrió); 24 h después, cierre suave sin EXPIRED (ver decideFollowUp).
  const threshold = new Date(now.getTime() - REMINDER_AFTER_HOURS * 60 * 60 * 1000);
  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");

  let remindersSent = 0;
  let remindersFailed = 0;
  let softClosed = 0; // sin respuesta 24 h tras el 2º contacto: cierre suave (sigue pudiendo pagar)
  let failedHeld = 0; // reintento aplazado: FAILED en las últimas ~20 h
  let whatsappTasks = 0; // solo-WhatsApp sin abrir: lo gestiona el vigía, no se les escribe desde aquí
  let lostAuto = 0; // caducados con motivo deducido
  let expiredUpdated = 0;
  let expiredFailed = 0;
  const failedQuotes: string[] = [];
  const skippedClients: Record<string, number> = {}; // ya pagó / ya es cliente: no se le escribe
  let heldReplied = 0; // el cliente contestó después del último contacto: ni cierre ni recordatorio, aviso a Juan
  let heldUnknown = 0; // no se pudo leer el buzón: fail-safe, no se cierra ni recuerda en esta ejecución
  const checkReply = createReplyChecker(); // Graph por remitente, máx. 40 por ejecución
  let smsSkipped = 0; // CLIENT_SMS=off o número con 2+ SMS FAILED en 7 días

  const candidates = await prisma.quote.findMany({
    where: {
      status: { in: ["SENT", "OPENED", "ACCEPTED"] },
      // Con pedido (declaró transferencia, carril de crédito…) se persigue por el pedido/factura,
      // no por aquí: ni 2º contacto ni cierre.
      orders: { none: {} },
      sentAt: {
        lte: threshold,
      },
      paidAt: null,
      validUntil: {
        gt: now,
      },
      // Ya cerrado (suave o con motivo del cliente): sin más recordatorios.
      lostReason: null,
      AND: [{ OR: [{ lostReasonNote: null }, { lostReasonNote: { not: NO_RESPONSE_NOTE } }] }],
    },
    include: {
      accessEvents: { select: { userAgent: true } },
      // Solo un recordatorio ENVIADO cuenta como hecho (los borradores WHATSAPP nunca
      // salían). SKIPPED = omitido por ser ya cliente. FAILED recientes frenan el reintento:
      // el cron corre 4×/día y sin esto el mismo recordatorio caído se reintentaba 4 veces.
      // También los envíos del enlace (el reloj de 24 h cuenta desde el último) y los WhatsApp
      // SENT (la marca «Ya lo traté» del vigía se refleja así: es el 2º contacto de solo-WhatsApp).
      messageLogs: {
        where: {
          OR: [
            { type: "REMINDER", status: { in: ["SENT", "SKIPPED", "FAILED"] } },
            { type: { in: ["PAY_LINK", "RESEND_PAY_LINK"] }, status: "SENT" },
            { channel: "WHATSAPP", status: "SENT" },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 40,
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
    const at = (m: { sentAt: Date | null; createdAt: Date }) => m.sentAt ?? m.createdAt;
    const placeholder = isPlaceholderEmail(quote.customerEmail);
    // Reloj: desde el último envío del enlace (si lo hay), no desde el primer sentAt.
    const lastLink = quote.messageLogs.filter((m) => m.type === "PAY_LINK" || m.type === "RESEND_PAY_LINK").map(at).sort((a, b) => b.getTime() - a.getTime())[0];
    const baseAt = lastLink && quote.sentAt && lastLink > quote.sentAt ? lastLink : quote.sentAt;
    // Solo cuenta lo posterior al último envío (un reenvío reabre el ciclo).
    const logs = quote.messageLogs.filter((m) => m.status === "SKIPPED" || (baseAt && at(m) >= baseAt));
    const sentLog = logs.find((m) => (placeholder ? m.status === "SENT" && (m.type === "REMINDER" || m.channel === "WHATSAPP") : m.type === "REMINDER" && m.status === "SENT"));
    const failedLog = logs.find((m) => m.type === "REMINDER" && m.status === "FAILED");
    const decision = decideFollowUp({
      status: quote.status,
      sentAt: baseAt,
      now,
      events: quote.accessEvents,
      openedAt: quote.openedAt,
      customerEmail: quote.customerEmail,
      paidAt: quote.paidAt,
      reminderSentAt: sentLog ? at(sentLog) : null,
      reminderSkipped: logs.some((m) => m.type === "REMINDER" && m.status === "SKIPPED"),
      lastFailedAt: failedLog ? failedLog.createdAt : null,
    });
    if (decision.action === "none") {
      if (!sentLog && failedLog && now.getTime() - failedLog.createdAt.getTime() < 20 * 3_600_000) failedHeld += 1;
      continue;
    }
    // Si el cliente escribió después del último contacto (email a hola@ o WhatsApp entrante), no se
    // cierra ni se recuerda (9-oct, Hella 2026-00236: cerrado a las 12:00 tras contestar). Sin poder
    // leer el buzón, tampoco: fail-safe.
    if (decision.action === "close" || decision.action === "remind_email") {
      const lastContact = decision.action === "close" ? (sentLog ? at(sentLog) : baseAt) : baseAt;
      let chk = { ok: false, replied: false };
      if (lastContact) {
        try {
          chk = await checkReply({ email: quote.customerEmail, phone: quote.customerPhone }, lastContact);
        } catch (err) {
          console.error("[quotes:reminders] comprobar respuesta falló", quote.quoteNumber, err);
        }
      }
      const gate = replyGate({ action: decision.action, replied: chk.replied, inboxOk: chk.ok });
      if (gate === "hold_unknown") {
        heldUnknown += 1;
        continue;
      }
      if (gate === "hold_replied") {
        heldReplied += 1;
        await notifyClientReplied(quote, lastContact!, baseUrl, decision.action);
        continue;
      }
    }
    // Cierre suave: lostReason es un campo existente; el status NO cambia a EXPIRED, así que el
    // cliente puede pagar si vuelve dentro de validUntil (y pagar limpia estas marcas).
    if (decision.action === "close") {
      if (yaCliente(quote).skip) continue; // ya pagó otro presupuesto de este encargo: no se marca perdido
      const closed = await prisma.quote.updateMany({
        where: { id: quote.id, paidAt: null, lostReason: null, status: { in: ["SENT", "OPENED", "ACCEPTED"] } },
        data: { lostReason: "NO_LONGER_NEEDED", lostReasonNote: NO_RESPONSE_NOTE, lostFeedbackAt: now },
      });
      softClosed += closed.count;
      continue;
    }
    // Solo-WhatsApp (@whatsapp.local): no se le escribe por email; aparece en el vigía con el
    // texto listo (lib/vigia.ts) y a las 48 h sin pago se cierra.
    if (decision.action === "whatsapp_task") {
      whatsappTasks += 1;
      continue;
    }

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
      opened: decision.opened,
    });

    // Reclamo previo (carrera cron/cron o cron/envío manual): sendingAt es el mismo candado que
    // usa finalizeAndSendQuote; si alguien lo tiene, o ya se pagó/cerró, no se escribe.
    const claimedAt = new Date();
    const claim = await prisma.quote.updateMany({
      where: {
        id: quote.id,
        paidAt: null,
        lostReason: null,
        status: { in: ["SENT", "OPENED", "ACCEPTED"] },
        OR: [{ sendingAt: null }, { sendingAt: { lt: new Date(claimedAt.getTime() - 10 * 60 * 1000) } }],
      },
      data: { sendingAt: claimedAt },
    });
    if (claim.count === 0) continue;
    const dupe = await prisma.messageLog.count({ where: { quoteId: quote.id, type: "REMINDER", status: "SENT", ...(baseAt ? { createdAt: { gte: baseAt } } : {}) } });
    if (dupe > 0) {
      await prisma.quote.updateMany({ where: { id: quote.id, sendingAt: claimedAt }, data: { sendingAt: null } });
      continue;
    }

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
    } finally {
      await prisma.quote
        .updateMany({ where: { id: quote.id, sendingAt: claimedAt }, data: { sendingAt: null } })
        .catch((e) => console.error("[quotes:reminders] no se pudo soltar el candado", quote.quoteNumber, e));
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

    // Cerrado sin respuesta (cierre suave): ya hubo 2º contacto; no se le añade un «ha caducado».
    if (quote.lostReasonNote === NO_RESPONSE_NOTE) continue;

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
    softClosed,
    heldReplied,
    heldUnknown,
    failedHeld,
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
