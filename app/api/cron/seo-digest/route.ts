import { NextResponse } from "next/server";
import { buildSeoDigest, buildSeoDigestHtml, buildIndexingHtml } from "@/lib/seo-digest";
import { buildIndexingReport, type IndexingReport } from "@/lib/seo-indexing";
import { sendMail } from "@/lib/azure-mail";
import { wrapClientEmailHtml } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    const [digest, indexingResult] = await Promise.all([
      buildSeoDigest(),
      buildIndexingReport().then(
        (r): { ok: true; report: IndexingReport } => ({ ok: true, report: r }),
        (err): { ok: false; error: string } => ({ ok: false, error: err?.message || "indexación no disponible" })
      ),
    ]);

    const indexingHtml = indexingResult.ok
      ? buildIndexingHtml(indexingResult.report)
      : `<p style="font-size:13px;color:#6b7682;margin:0 0 16px;">Indexación: no se pudo consultar (${indexingResult.error})</p>`;

    const toIndex = indexingResult.ok
      ? indexingResult.report.notIndexed.length + indexingResult.report.stale.length
      : 0;
    const subject = `SEO/AEO semanal · ${digest.totals.clicks} clics · ${digest.totals.impressions} impresiones · ${digest.lowCtr.length} oportunidades CTR${
      indexingResult.ok ? ` · ${toIndex} a indexar` : ""
    }`;

    await sendMail({ to, subject, html: wrapClientEmailHtml(buildSeoDigestHtml(digest, indexingHtml)) });

    return NextResponse.json({
      ok: true,
      range: digest.range,
      clicks: digest.totals.clicks,
      impressions: digest.totals.impressions,
      lowCtr: digest.lowCtr.length,
      strikingDistance: digest.strikingDistance.length,
      indexing: indexingResult.ok
        ? {
            checked: indexingResult.report.checked,
            notIndexed: indexingResult.report.notIndexed.length,
            stale: indexingResult.report.stale.length,
          }
        : { error: indexingResult.error },
    });
  } catch (err: any) {
    console.error("[cron:seo-digest] failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "seo digest failed" }, { status: 500 });
  }
}
