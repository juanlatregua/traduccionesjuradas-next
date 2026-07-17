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

  // UN aviso por PERSONA, no por documento. La puerta es multi-documento: una
  // sesión con 3 documentos deja 3 filas con el mismo email, y enviar por fila
  // significaba 3 correos idénticos el mismo día (queja de spam garantizada, y
  // el dominio de envío es del que depende el negocio).
  const byEmail = new Map<string, typeof candidates>();
  for (const lead of candidates) {
    if (!lead.clientEmail) continue;
    const key = lead.clientEmail.toLowerCase();
    const group = byEmail.get(key);
    if (group) group.push(lead);
    else byEmail.set(key, [lead]);
  }

  let sent = 0;
  let failed = 0;

  for (const [email, group] of byEmail) {
    try {
      await sendLeadReminderEmail({
        toEmail: group[0].clientEmail!,
        // El nombre casi nunca está (la puerta no lo pide); si alguna fila del
        // grupo lo trae, se usa.
        clientName: group.find((l) => l.clientName)?.clientName ?? null,
      });
      // Marcar TODAS las filas del grupo: si solo se marcase la enviada, las
      // hermanas seguirían siendo candidatas y reenviarían mañana (la ventana
      // es de 7 días).
      await prisma.documentAnalysis.updateMany({
        where: { id: { in: group.map((l) => l.id) } },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    } catch (err: any) {
      console.error(`[lead-reminders] Failed for ${email}:`, err?.message || err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, scanned: candidates.length, leads: byEmail.size, sent, failed });
}

export const POST = GET;
