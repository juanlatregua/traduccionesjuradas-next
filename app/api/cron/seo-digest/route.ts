import { NextResponse } from "next/server";
import { buildSeoDigest, buildSeoDigestHtml } from "@/lib/seo-digest";
import { sendMail } from "@/lib/azure-mail";
import { wrapClientEmailHtml } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Cron semanal (lunes 06:00 UTC): digest SEO/AEO desde Search Console — top
   consultas, CTR bajo con muchas impresiones, striking distance (pos 5-15) y
   top páginas en los últimos 28 días. El análisis profundo (AEO/fixes) lo hace
   el subagente seo-aeo bajo demanda con estos datos. */

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

  const to = process.env.PRESUPUESTO_TO;
  if (!to) {
    return NextResponse.json({ ok: false, error: "Missing PRESUPUESTO_TO" }, { status: 500 });
  }

  try {
    const digest = await buildSeoDigest();
    const subject = `SEO/AEO semanal · ${digest.totals.clicks} clics · ${digest.totals.impressions} impresiones · ${digest.lowCtr.length} oportunidades CTR`;
    await sendMail({ to, subject, html: wrapClientEmailHtml(buildSeoDigestHtml(digest)) });
    return NextResponse.json({
      ok: true,
      range: digest.range,
      clicks: digest.totals.clicks,
      impressions: digest.totals.impressions,
      lowCtr: digest.lowCtr.length,
      strikingDistance: digest.strikingDistance.length,
    });
  } catch (err: any) {
    console.error("[cron:seo-digest] failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "seo digest failed" }, { status: 500 });
  }
}
