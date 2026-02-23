import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import {
  buildExpiredEmail,
  buildReminderEmail,
  buildWhatsAppReminderText,
} from "@/lib/quote-messages";
import { sendQuoteEmail } from "@/lib/quote-email";

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
  let expiredUpdated = 0;

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
    const msg = buildReminderEmail({
      name: quote.customerName || "cliente",
      quoteNumber: quote.quoteNumber,
      sentDate: quote.sentAt || quote.createdAt,
      payUrl,
    });
    const waText = buildWhatsAppReminderText({
      name: quote.customerName || "cliente",
      payUrl,
    });

    try {
      const sent = await sendQuoteEmail({
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
    take: 200,
  });

  for (const quote of expirable) {
    const payUrl = `${baseUrl}/q/${quote.publicToken}`;
    const expired = buildExpiredEmail({
      name: quote.customerName || "cliente",
      quoteNumber: quote.quoteNumber,
      payUrl,
    });

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: "EXPIRED",
      },
    });
    expiredUpdated += 1;

    try {
      const sent = await sendQuoteEmail({
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

  return NextResponse.json({
    ok: true,
    remindersSent,
    remindersFailed,
    expiredUpdated,
    scanned: candidates.length,
    expirable: expirable.length,
  });
}

export const POST = GET;
