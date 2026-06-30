import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import {
  buildTranslatorReviewEmail,
  buildWhatsAppTranslatorReviewText,
  resolveCaptureLang,
} from "@/lib/quote-messages";
import { sendQuoteEmailWithRetry, isPlaceholderEmail } from "@/lib/quote-email";
import { sendStaffAlertSMS } from "@/lib/sms";

export const runtime = "nodejs";

/**
 * Captación de leads con presupuesto que NO llegó / no se revisó. Ofrece que un
 * traductor jurado analice el caso personalmente (mensaje humano, sin precio
 * vinculante). Cohortes:
 *   A) Nunca entregado (no consta email PAY_LINK enviado) y email entregable → EMAIL (sin pay-link).
 *   B) Entregado pero frío (SENT/OPENED, sin abrir, > COLD_DAYS) → EMAIL (con pay-link).
 *   C) Lead @whatsapp.local → borrador de WhatsApp para envío manual + aviso al staff.
 *
 * SEGURO POR DEFECTO: dry-run (solo lista candidatos). Envía únicamente con ?send=true.
 * Dedup: omite quotes que ya tienen un TRANSLATOR_REVIEW_OFFER registrado.
 *
 * REQUISITO DE DESPLIEGUE: el enum QuoteMessageType.TRANSLATOR_REVIEW_OFFER es nuevo;
 * ejecutar `npx prisma db push` ANTES de usar ?send=true (el dry-run funciona sin migrar).
 */

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

  const { searchParams } = new URL(req.url);
  const send = searchParams.get("send") === "true";
  const COLD_DAYS = Number(process.env.QUOTES_COLD_DAYS || 2);
  const now = new Date();
  const coldThreshold = new Date(now.getTime() - COLD_DAYS * 24 * 60 * 60 * 1000);
  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  const { buildSignedOrderUrl } = await import("@/lib/order-token");

  const quotes = await prisma.quote.findMany({
    where: {
      deletedAt: null,
      paidAt: null,
      status: { in: ["DRAFT", "SENT", "OPENED", "ACCEPTED", "EXPIRED"] },
    },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      sourceLang: true,
      targetLang: true,
      publicToken: true,
      sentAt: true,
      openedAt: true,
      messageLogs: {
        select: { channel: true, type: true, status: true },
      },
      orders: {
        select: { reference: true, clientLocale: true },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  type Candidate = {
    quoteId: string;
    quoteNumber: string;
    cohort: "A_NUNCA_ENTREGADO" | "B_FRIO" | "C_WHATSAPP";
    email: string;
    phone: string | null;
    lang: "es" | "fr" | "en";
    payUrl: string | null;
  };

  const candidates: Candidate[] = [];

  for (const q of quotes) {
    // Dedup: ya se le ofreció la revisión personal.
    if (q.messageLogs.some((m) => m.type === "TRANSLATOR_REVIEW_OFFER")) continue;

    const placeholder = isPlaceholderEmail(q.customerEmail);
    const delivered = q.messageLogs.some(
      (m) => m.channel === "EMAIL" && m.status === "SENT" &&
        ["PAY_LINK", "RESEND_PAY_LINK", "REMINDER"].includes(m.type)
    );
    const order = q.orders[0] || null;
    const lang = resolveCaptureLang({ clientLocale: order?.clientLocale, sourceLang: q.sourceLang });
    const payUrl = order
      ? buildSignedOrderUrl(order.reference, "pagar")
      : `${baseUrl}/q/${q.publicToken}`;

    let cohort: Candidate["cohort"] | null = null;
    let useUrl: string | null = null;
    if (placeholder) {
      cohort = "C_WHATSAPP";
      useUrl = delivered ? payUrl : null;
    } else if (!delivered) {
      // Nunca entregado: NO enlazamos un presupuesto sin revisar.
      cohort = "A_NUNCA_ENTREGADO";
      useUrl = null;
    } else if (
      ["SENT", "OPENED"].includes(q.status) && !q.openedAt && q.sentAt && q.sentAt < coldThreshold
    ) {
      cohort = "B_FRIO";
      useUrl = payUrl;
    }
    if (!cohort) continue;

    candidates.push({
      quoteId: q.id,
      quoteNumber: q.quoteNumber,
      cohort,
      email: q.customerEmail,
      phone: q.customerPhone || null,
      lang,
      payUrl: useUrl,
    });
  }

  if (!send) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      coldDays: COLD_DAYS,
      total: candidates.length,
      byCohort: {
        A_NUNCA_ENTREGADO: candidates.filter((c) => c.cohort === "A_NUNCA_ENTREGADO").length,
        B_FRIO: candidates.filter((c) => c.cohort === "B_FRIO").length,
        C_WHATSAPP: candidates.filter((c) => c.cohort === "C_WHATSAPP").length,
      },
      candidates,
      note: "dry-run: nada enviado. Llama con ?send=true para enviar (requiere prisma db push del enum TRANSLATOR_REVIEW_OFFER).",
    });
  }

  let emailsSent = 0;
  let emailsFailed = 0;
  let whatsappDrafts = 0;
  const failed: string[] = [];
  const whatsappPending: string[] = [];

  for (const c of candidates) {
    const displayName = candidatesName(c);

    if (c.cohort === "C_WHATSAPP") {
      const wa = buildWhatsAppTranslatorReviewText({ name: displayName, lang: c.lang, payUrl: c.payUrl });
      try {
        await prisma.messageLog.create({
          data: {
            quoteId: c.quoteId,
            channel: "WHATSAPP",
            type: "TRANSLATOR_REVIEW_OFFER",
            recipient: c.phone || c.email,
            body: wa,
            status: "DRAFT",
          },
        });
        whatsappDrafts += 1;
        whatsappPending.push(c.quoteNumber);
      } catch {
        failed.push(c.quoteNumber);
      }
      continue;
    }

    const msg = buildTranslatorReviewEmail({ name: displayName, lang: c.lang, payUrl: c.payUrl });
    try {
      const sent = await sendQuoteEmailWithRetry({ to: c.email, subject: msg.subject, body: msg.body });
      await prisma.messageLog.create({
        data: {
          quoteId: c.quoteId,
          channel: "EMAIL",
          type: "TRANSLATOR_REVIEW_OFFER",
          recipient: c.email,
          subject: msg.subject,
          body: msg.body,
          sentAt: new Date(),
          providerId: sent.providerId,
          status: "SENT",
        },
      });
      emailsSent += 1;
    } catch (err: any) {
      emailsFailed += 1;
      failed.push(c.quoteNumber);
      await prisma.messageLog
        .create({
          data: {
            quoteId: c.quoteId,
            channel: "EMAIL",
            type: "TRANSLATOR_REVIEW_OFFER",
            recipient: c.email,
            subject: msg.subject,
            body: `${msg.body}\n\n[ERROR]: ${String(err?.message || err || "unknown")}`,
            status: "FAILED",
          },
        })
        .catch(() => {});
    }
  }

  if (whatsappDrafts > 0 || emailsFailed > 0) {
    const parts: string[] = [];
    if (whatsappDrafts > 0) parts.push(`${whatsappDrafts} oferta(s) WhatsApp pendiente(s) de envío manual [${whatsappPending.join(", ")}]`);
    if (emailsFailed > 0) parts.push(`${emailsFailed} email(s) fallido(s) [${failed.join(", ")}]`);
    await sendStaffAlertSMS(
      `TraduccionesJuradas (captación de presupuestos): ${parts.join("; ")}.`,
      "quotes_capture"
    ).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    dryRun: false,
    emailsSent,
    emailsFailed,
    whatsappDrafts,
    total: candidates.length,
  });
}

// Nombre legible para el saludo: si el email es marcador de WhatsApp no sirve.
function candidatesName(c: { email: string }) {
  if (!c.email || isPlaceholderEmail(c.email)) return "cliente";
  const local = c.email.split("@")[0] || "";
  return local || "cliente";
}

export const POST = GET;
