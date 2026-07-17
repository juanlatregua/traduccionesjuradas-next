import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLeadReminderEmail } from "@/lib/email";

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
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const after = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h ago

  // Solo leads de la PUERTA. Se excluyen a propósito:
  //  · exp:*   → expedientes que el staff está presupuestando a mano; decirles
  //              "no llegaste a completar el pedido" sería falso y queda fatal.
  //  · staff:* → documentos del propio traductor en el builder.
  // Antes esto no hacía falta porque el email solo se estampaba en el checkout y
  // el cron casi nunca encontraba a nadie; ahora la puerta lo captura al entrar.
  const candidates = await prisma.documentAnalysis.findMany({
    where: {
      status: { in: ["QUOTE_GENERATED", "PAYMENT_PENDING"] },
      clientEmail: { not: null },
      orderId: null,
      reminderSentAt: null,
      createdAt: { gte: since, lte: after },
      NOT: [
        { sessionToken: { startsWith: "exp:" } },
        { sessionToken: { startsWith: "staff:" } },
      ],
    },
    take: 100,
  });

  let sent = 0;
  let failed = 0;

  for (const lead of candidates) {
    if (!lead.clientEmail) continue;
    try {
      await sendLeadReminderEmail({
        toEmail: lead.clientEmail,
        clientName: lead.clientName,
      });
      await prisma.documentAnalysis.update({
        where: { id: lead.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    } catch (err: any) {
      console.error(`[lead-reminders] Failed for ${lead.id}:`, err?.message || err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, scanned: candidates.length, sent, failed });
}

export const POST = GET;
