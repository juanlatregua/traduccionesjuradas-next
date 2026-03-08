import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPaymentReminderEmail } from "@/lib/email";
import { buildSignedOrderUrl } from "@/lib/order-token";

export const runtime = "nodejs";

function hasCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === secret || header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!hasCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000); // 14 days ago
  const after = new Date(now.getTime() - 48 * 60 * 60 * 1000); // 48h ago

  const candidates = await prisma.order.findMany({
    where: {
      paymentStatus: "PENDING",
      createdAt: { gte: since, lte: after },
    },
    include: {
      events: {
        where: { type: "order.payment_reminder_sent" },
        take: 1,
      },
    },
    take: 100,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const order of candidates) {
    if (order.events.length > 0) {
      skipped++;
      continue;
    }

    const paymentUrl = buildSignedOrderUrl(order.reference, "pagar");

    try {
      await sendPaymentReminderEmail({
        toEmail: order.clientEmail,
        reference: order.reference,
        title: order.title,
        amountCents: order.amountCents,
        paymentUrl,
      });
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "order.payment_reminder_sent",
          message: `Recordatorio de pago enviado a ${order.clientEmail}`,
        },
      });
      sent++;
    } catch (err: any) {
      console.error(`[order-reminders] Failed for ${order.reference}:`, err?.message || err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, scanned: candidates.length, sent, failed, skipped });
}

export const POST = GET;
