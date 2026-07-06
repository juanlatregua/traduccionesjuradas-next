import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPaymentReminderEmail, sendStaffPaymentPendingEmail } from "@/lib/email";
import { sendSMS } from "@/lib/sms";
import { buildSignedOrderUrl } from "@/lib/order-token";

export const runtime = "nodejs";

// Recordatorios de cobro escalados (pedidos cobrados por transferencia, etc.):
//  - Fase 1 (≥48h sin pagar): email amable al cliente con link a su zona para
//    subir el justificante + aviso a Juan (email + WhatsApp).
//  - Fase 2 (≥7d sin pagar): recordatorio SOLO a Juan (se encarga manualmente).
// Idempotente: cada fase deja su OrderEvent guardián y no se repite.
const STAGE1_MS = 48 * 60 * 60 * 1000;
const STAGE2_MS = 7 * 24 * 60 * 60 * 1000;
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000; // deja de recordar pasados 14 días
const EV_STAGE1 = "order.payment_reminder_sent";
const EV_STAGE2 = "order.payment_reminder_staff_only_sent";

function hasCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === secret || header === `Bearer ${secret}`;
}

function staffWhatsApp() {
  return process.env.STAFF_WHATSAPP_ALERT || "+34663727415";
}

async function alertStaffWhatsApp(body: string) {
  try {
    await sendSMS({ to: staffWhatsApp(), body, channel: "whatsapp" });
  } catch (err: any) {
    console.error("[order-reminders] whatsapp staff:", err?.message || err);
  }
}

export async function GET(req: Request) {
  if (!hasCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  // dry-run: lista qué haría sin enviar nada ni escribir eventos (?dry=1).
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_MS); // 14 días atrás
  const stage1Before = new Date(now.getTime() - STAGE1_MS); // creado hace ≥48h

  const candidates = await prisma.order.findMany({
    where: {
      paymentStatus: "PENDING",
      createdAt: { gte: since, lte: stage1Before },
    },
    include: {
      events: {
        where: { type: { in: [EV_STAGE1, EV_STAGE2] } },
        select: { type: true },
      },
    },
    take: 200,
  });

  let stage1 = 0;
  let stage2 = 0;
  let failed = 0;
  let skipped = 0;
  const would: { reference: string; stage: 1 | 2 }[] = [];

  for (const order of candidates) {
    const types = new Set(order.events.map((e) => e.type));
    const hasStage1 = types.has(EV_STAGE1);
    const hasStage2 = types.has(EV_STAGE2);
    const ageMs = now.getTime() - order.createdAt.getTime();
    const lang = order.clientLocale === "fr" ? "fr" : "es";

    if (dry) {
      if (!hasStage1) { would.push({ reference: order.reference, stage: 1 }); stage1++; }
      else if (!hasStage2 && ageMs >= STAGE2_MS) { would.push({ reference: order.reference, stage: 2 }); stage2++; }
      else skipped++;
      continue;
    }

    try {
      if (!hasStage1) {
        // Fase 1: cliente + Juan (email + WhatsApp)
        const paymentUrl = buildSignedOrderUrl(order.reference, "pagar");
        await sendPaymentReminderEmail({
          toEmail: order.clientEmail,
          reference: order.reference,
          title: order.title,
          amountCents: order.amountCents,
          paymentUrl,
          lang,
        });
        await sendStaffPaymentPendingEmail({
          reference: order.reference,
          title: order.title,
          amountCents: order.amountCents,
          clientEmail: order.clientEmail,
          stage: "client_plus_staff",
        });
        await alertStaffWhatsApp(
          `TraduccionesJuradas: recordatorio de pago enviado al cliente ${order.clientEmail} (ref ${order.reference}, ${(order.amountCents / 100).toFixed(2)} €). Sin pagar 48h.`
        );
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: EV_STAGE1,
            message: `Recordatorio de pago (48h) enviado al cliente ${order.clientEmail} + aviso a staff (email + WhatsApp).`,
          },
        });
        stage1++;
      } else if (!hasStage2 && ageMs >= STAGE2_MS) {
        // Fase 2: solo Juan
        await sendStaffPaymentPendingEmail({
          reference: order.reference,
          title: order.title,
          amountCents: order.amountCents,
          clientEmail: order.clientEmail,
          stage: "staff_only",
        });
        await alertStaffWhatsApp(
          `TraduccionesJuradas: ${order.reference} sigue SIN PAGAR tras 7 días. Encárgate tú (al cobrar, sube el justificante y finaliza).`
        );
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: EV_STAGE2,
            message: `Escalado: pago sin resolver tras 7 días — aviso solo a staff (email + WhatsApp).`,
          },
        });
        stage2++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      console.error(`[order-reminders] Failed for ${order.reference}:`, err?.message || err);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, dry, scanned: candidates.length, stage1, stage2, failed, skipped, ...(dry && { would }) });
}

export const POST = GET;
