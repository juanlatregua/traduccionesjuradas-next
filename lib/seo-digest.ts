// lib/seo-digest.ts — Construye el digest SEO/AEO semanal a partir de los datos
// de Search Console (28 días). Las 3 palancas: páginas/consultas con CTR bajo y
// muchas impresiones (título/meta flojos), consultas en "striking distance"
// (posición 5-15, a un empujón del top), y el top de tráfico real.

import { querySearchAnalytics, defaultDateRange, type GscRow } from "@/lib/gsc";

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

export function buildSeoDigestHtml(d: SeoDigest): string {
  const t = d.totals;
  return `
    <h1 style="font-size:20px;margin:0 0 4px;">Digest SEO/AEO semanal</h1>
    <p style="color:#6b7682;font-size:13px;margin:0 0 16px;">Search Console · ${d.range.startDate} → ${d.range.endDate} (28 días)</p>

    <p style="font-size:14px;margin:0 0 16px;">
      <b>${t.clicks}</b> clics · <b>${t.impressions}</b> impresiones · CTR <b>${pct(t.ctr)}</b> · posición media <b>${pos(t.position)}</b>
    </p>

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
