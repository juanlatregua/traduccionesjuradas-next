import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLeadNudgeEmail } from "@/lib/email";
import { getLanguageName, isPublicAutoPriceable } from "@/lib/pricing-engine/languages";
import { checkRateLimit } from "@/lib/rate-limit";
import { isPlaceholderEmail } from "@/lib/azure-mail";
import { isStaffEmail } from "@/lib/staff-access";
import { SITE_BASE_URL } from "@/lib/contact";
import { resolveLocale } from "@/lib/i18n/locales";
import { findLiveBlock } from "@/lib/respuesta-guard-db";
import { createReviewToken, groupNudgeLeads, nudgeSkipReason } from "@/lib/lead-nudge";

export const runtime = "nodejs";

function hasCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === secret || header === `Bearer ${secret}`;
}

// Orden de Juan (6-oct-2026): al lead de la puerta que VIO precio y no pagó, un
// email a los ~5 min («No olvide finalizar su pedido» + «revisar a mano»).
// Una vez por persona y 7 días (checkRateLimit), solo con consentimiento (LSSI).
export async function GET(req: Request) {
  if (!hasCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Sin NEXTAUTH_SECRET." }, { status: 500 });
  }

  const now = Date.now();
  const rows = await prisma.documentAnalysis.findMany({
    where: {
      status: { in: ["QUOTE_GENERATED", "PAYMENT_PENDING"] },
      quoteAmount: { gt: 0 },
      clientEmail: { not: null },
      marketingConsent: true,
      orderId: null,
      createdAt: { gte: new Date(now - 60 * 60 * 1000), lte: new Date(now - 5 * 60 * 1000) },
      NOT: [{ sessionToken: { startsWith: "exp:" } }, { sessionToken: { startsWith: "staff:" } }],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const groups = groupNudgeLeads(rows as any, (email) => isStaffEmail(email) || isPlaceholderEmail(email));
  const day = new Date(now - 24 * 60 * 60 * 1000);
  const counts = { scanned: rows.length, leads: groups.length, sent: 0, failed: 0, skipped: {} as Record<string, number> };
  const skip = (why: string) => {
    counts.skipped[why] = (counts.skipped[why] || 0) + 1;
  };

  for (const g of groups) {
    try {
      const [paid, recentDocs] = await Promise.all([
        prisma.order.findFirst({
          where: { clientEmail: { equals: g.email, mode: "insensitive" }, paymentStatus: "PAID", paidAt: { gte: day } },
          select: { id: true },
        }),
        prisma.documentAnalysis.findMany({
          where: { clientEmail: { equals: g.email, mode: "insensitive" }, createdAt: { gte: day } },
          select: { sessionToken: true, orderId: true },
        }),
      ]);
      const expRefs = recentDocs
        .map((d) => d.sessionToken || "")
        .filter((t) => t.startsWith("exp:"))
        .flatMap((t) => [t, t.slice(4)]);
      const priceRequests = await prisma.lavoriPriceRequest.findMany({
        where: {
          createdAt: { gte: day },
          OR: [
            { customerHint: { contains: g.email, mode: "insensitive" } },
            { expedienteRef: { in: [`puerta:${g.sessionToken}`, ...expRefs] } },
          ],
        },
        select: { status: true, customerHint: true, expedienteRef: true },
      });
      const why = nudgeSkipReason({
        email: g.email,
        sessionToken: g.sessionToken,
        paidOrderLast24h: !!paid,
        recentDocs,
        priceRequests: priceRequests.map((r) => ({ ...r, status: String(r.status) })),
      });
      if (why) {
        skip(why);
        continue;
      }

      // Quien ya tiene un presupuesto vivo (aunque sea por WhatsApp) o un pedido pagado/en curso no es un lead.
      const live = await findLiveBlock({ email: g.email, phone: g.rows.find((r) => r.clientPhone)?.clientPhone }, { leadAt: new Date(Math.min(...g.rows.map((r) => r.createdAt.getTime()))) });
      if (live) {
        skip("presupuesto-vivo");
        continue;
      }

      const gate = await checkRateLimit({ key: `lead-nudge:${g.email}`, limit: 1, windowMs: 7 * 24 * 60 * 60 * 1000 });
      if (!gate.ok) {
        skip("dedup");
        continue;
      }

      // Idioma de la puerta: solo queda guardado en OrderSession.clientLocale cuando
      // el lead llegó a /api/puerta/checkout; si no, español.
      let locale = resolveLocale("es");
      if (g.orderReference) {
        const os = await prisma.orderSession.findFirst({ where: { reference: g.orderReference }, select: { clientLocale: true } }).catch(() => null);
        locale = resolveLocale(os?.clientLocale);
      }

      const token = createReviewToken(secret, g.sessionToken, locale);
      await sendLeadNudgeEmail({
        toEmail: g.email,
        clientName: g.clientName,
        locale,
        docs: g.rows.map((l) => {
          const src = (l.sourceLanguage || "").toLowerCase();
          const tgt = (l.targetLanguage || "").toLowerCase();
          const foreign = src && src !== "es" ? src : tgt;
          const par = src && tgt ? ` (${getLanguageName(src)} → ${getLanguageName(tgt)})` : "";
          return {
            label: `${l.documentType || l.fileName}${par}`,
            priceEur: l.quoteAmount != null && foreign && isPublicAutoPriceable(foreign) ? Number(l.quoteAmount) : null,
          };
        }),
        reviewUrl: `${SITE_BASE_URL}/revisar-presupuesto?t=${encodeURIComponent(token)}`,
      });
      counts.sent++;
    } catch (err: any) {
      console.error(`[lead-nudge] Failed for ${g.email}:`, err?.message || err);
      counts.failed++;
    }
  }

  return NextResponse.json({ ok: true, ...counts });
}

export const POST = GET;
