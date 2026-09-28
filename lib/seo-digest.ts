// lib/seo-digest.ts — Construye el digest SEO/AEO semanal a partir de los datos
// de Search Console (28 días). Las 3 palancas: páginas/consultas con CTR bajo y
// muchas impresiones (título/meta flojos), consultas en "striking distance"
// (posición 5-15, a un empujón del top), y el top de tráfico real.

import { querySearchAnalytics, defaultDateRange, type GscRow } from "@/lib/gsc";
import type { IndexingReport, IndexingItem } from "@/lib/seo-indexing";

export type SeoDigest = {
  range: { startDate: string; endDate: string };
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  topQueries: GscRow[];
  lowCtr: GscRow[];
  strikingDistance: GscRow[];
  topPages: GscRow[];
};

export async function buildSeoDigest(): Promise<SeoDigest> {
  const range = defaultDateRange();
  // Totales SIN dimensión: GSC omite las consultas anonimizadas de las filas por
  // query (aquí ~95% de los clics), así que sumar byQuery infrarreporta. La
  // consulta sin dimensiones devuelve una única fila con los totales reales.
  const [totalRows, byQuery, byPage] = await Promise.all([
    querySearchAnalytics({ dimensions: [], ...range, rowLimit: 1 }),
    querySearchAnalytics({ dimensions: ["query"], ...range, rowLimit: 1000 }),
    querySearchAnalytics({ dimensions: ["page"], ...range, rowLimit: 500 }),
  ]);

  const total = totalRows[0];
  const clicks = total?.clicks ?? 0;
  const impressions = total?.impressions ?? 0;
  const ctr = impressions ? clicks / impressions : 0;
  const position = total?.position ?? 0;

  const topQueries = [...byQuery].sort((a, b) => b.impressions - a.impressions).slice(0, 15);
  const lowCtr = byQuery
    .filter((r) => r.impressions >= 100 && r.ctr < 0.02)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);
  const strikingDistance = byQuery
    .filter((r) => r.position >= 5 && r.position <= 15 && r.impressions >= 30)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);
  const topPages = [...byPage].sort((a, b) => b.clicks - a.clicks).slice(0, 15);

  return {
    range,
    totals: { clicks, impressions, ctr, position },
    topQueries,
    lowCtr,
    strikingDistance,
    topPages,
  };
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pos = (n: number) => n.toFixed(1);

function rowsTable(rows: GscRow[], firstColLabel: string): string {
  if (!rows.length) return `<p style="color:#6b7682;font-size:13px;">Sin datos en este periodo.</p>`;
  const head = `<tr style="text-align:left;border-bottom:1px solid #e3ddd0;">
    <th style="padding:6px 10px 6px 0;">${firstColLabel}</th>
    <th style="padding:6px 10px;">Clics</th>
    <th style="padding:6px 10px;">Impr.</th>
    <th style="padding:6px 10px;">CTR</th>
    <th style="padding:6px 10px;">Pos.</th>
  </tr>`;
  const body = rows
    .map((r) => {
      const key = (r.keys?.[0] || "—").replace(/^https?:\/\/[^/]+/, "");
      return `<tr style="border-bottom:1px solid #f4efe6;">
        <td style="padding:6px 10px 6px 0;font-size:13px;">${key}</td>
        <td style="padding:6px 10px;font-size:13px;">${r.clicks}</td>
        <td style="padding:6px 10px;font-size:13px;">${r.impressions}</td>
        <td style="padding:6px 10px;font-size:13px;">${pct(r.ctr)}</td>
        <td style="padding:6px 10px;font-size:13px;">${pos(r.position)}</td>
      </tr>`;
    })
    .join("");
  return `<table style="border-collapse:collapse;width:100%;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">${head}${body}</table>`;
}

function fmtCrawl(v: string | null): string {
  if (!v) return "nunca";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "nunca";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildIndexingHtml(r: IndexingReport): string {
  const pending: IndexingItem[] = [...r.notIndexed, ...r.stale];
  const header = `<h2 style="font-size:15px;margin:18px 0 6px;">🔎 Indexación — pide «Solicitar indexación» de estas (Google deja ~10 al día)</h2>`;
  const errorLine = r.errors.length
    ? `<p style="color:#9a9a9a;font-size:12px;margin:4px 0 0;">Errores de inspección: ${r.errors[0]}</p>`
    : "";

  const foreign = r.foreignCanonical.length
    ? `<p style="font-size:13px;color:#b91c1c;margin:0 0 8px;">⚠ Google da como original de estas páginas una web AJENA (posible copia/spam): ${r.foreignCanonical
        .map((f) => `${f.url} → ${f.googleCanonical}`)
        .join(" · ")}. Pide indexación y, si sigue, denúncialo: https://developers.google.com/search/help/report-quality-issues</p>`
    : "";

  // Un fallo de la API no puede salir como «todo indexado».
  const partial = r.checked < r.total
    ? `<p style="font-size:13px;color:#b45309;margin:0 0 8px;">⚠ Solo se pudieron revisar ${r.checked} de ${r.total} URLs del sitemap.</p>`
    : "";

  if (!pending.length) {
    if (partial || foreign) return `${header}${foreign}${partial}${errorLine}`;
    return `${header}
      <p style="font-size:13px;margin:0;">✓ Las ${r.checked} URLs del sitemap están indexadas y al día.</p>
      ${errorLine}`;
  }

  const top = pending.slice(0, 10);
  const rows = top
    .map(
      (item) => `<p style="font-size:13px;margin:0 0 4px;font-family:monospace;">
        ${item.url} <span style="color:#6b7682;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">— ${item.coverageState} · último rastreo ${fmtCrawl(item.lastCrawlTime)}</span>
      </p>`
    )
    .join("");

  const remaining = pending.length - top.length;
  const moreLine = remaining > 0
    ? `<p style="font-size:12px;color:#6b7682;margin:6px 0 0;">y ${remaining} más — pídelas otro día.</p>`
    : "";

  return `${header}
    ${foreign}
    ${partial}
    <p style="font-size:12px;color:#6b7682;margin:0 0 8px;">Sin indexar (${r.notIndexed.length}) y rastreadas antes del último cambio (${r.stale.length}).</p>
    ${rows}
    ${moreLine}
    ${errorLine}`;
}

export function buildSeoDigestHtml(d: SeoDigest, indexingHtml?: string): string {
  const t = d.totals;
  return `
    <h1 style="font-size:20px;margin:0 0 4px;">Digest SEO/AEO semanal</h1>
    <p style="color:#6b7682;font-size:13px;margin:0 0 16px;">Search Console · ${d.range.startDate} → ${d.range.endDate} (28 días)</p>

    <p style="font-size:14px;margin:0 0 16px;">
      <b>${t.clicks}</b> clics · <b>${t.impressions}</b> impresiones · CTR <b>${pct(t.ctr)}</b> · posición media <b>${pos(t.position)}</b>
    </p>

    ${indexingHtml || ""}

    <h2 style="font-size:15px;margin:18px 0 6px;">🎯 CTR bajo con muchas impresiones (reescribir título/meta)</h2>
    ${rowsTable(d.lowCtr, "Consulta")}

    <h2 style="font-size:15px;margin:18px 0 6px;">🪜 Striking distance — posición 5-15 (un empujón al top)</h2>
    ${rowsTable(d.strikingDistance, "Consulta")}

    <h2 style="font-size:15px;margin:18px 0 6px;">🔝 Top consultas por impresiones</h2>
    ${rowsTable(d.topQueries, "Consulta")}

    <h2 style="font-size:15px;margin:18px 0 6px;">📄 Top páginas por clics</h2>
    ${rowsTable(d.topPages, "Página")}

    <p style="color:#6b7682;font-size:12px;margin-top:20px;border-top:1px solid #e3ddd0;padding-top:10px;">
      Para análisis profundo (AEO, fixes de schema/contenido), invoca el subagente <code>seo-aeo</code> con estos datos.
    </p>
  `;
}
