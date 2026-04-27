// scripts/gsc-report.mjs — Reporte SEO completo desde Google Search Console
// Uso: node scripts/gsc-report.mjs [days=28]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createSign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITE = "sc-domain:traduccionesjuradas.net";
const DAYS = Number(process.argv[2] || 28);

const env = readFileSync(resolve(ROOT, ".env.local"), "utf8");
const sa = JSON.parse(env.match(/GOOGLE_VISION_SERVICE_ACCOUNT_JSON='([\s\S]+?)'\n/)[1]);

function b64u(s) {
  return Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64u(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const input = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  const sig = signer.sign(sa.private_key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${input}.${sig}`,
    }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(JSON.stringify(d));
  return d.access_token;
}

const token = await getToken();
const endDate = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10); // GSC tarda ~2 días
const startDate = new Date(Date.now() - (DAYS + 2) * 86400000).toISOString().slice(0, 10);

async function query(body) {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`;
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ startDate, endDate, dataState: "all", ...body }),
  });
  const d = await r.json();
  if (d.error) throw new Error(JSON.stringify(d.error));
  return d.rows || [];
}

function pct(n) { return (n * 100).toFixed(2) + "%"; }
function pos(n) { return n.toFixed(1); }
function table(rows, cols) {
  const widths = cols.map((c) => Math.max(c.label.length, ...rows.map((r) => String(c.get(r)).length)));
  const sep = "| " + widths.map((w) => "-".repeat(w)).join(" | ") + " |";
  const head = "| " + cols.map((c, i) => c.label.padEnd(widths[i])).join(" | ") + " |";
  const body = rows.map((r) => "| " + cols.map((c, i) => String(c.get(r)).padEnd(widths[i])).join(" | ") + " |").join("\n");
  return [head, sep, body].join("\n");
}

console.log(`📊 GSC Report — ${SITE}`);
console.log(`📅 ${startDate} → ${endDate} (${DAYS} días)\n`);

// 1. Totales globales
const totalsRow = await query({ dimensions: [], rowLimit: 1 });
const totals = totalsRow[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

// 2. Top queries (por clicks)
const topQueries = await query({ dimensions: ["query"], rowLimit: 25 });

// 3. Top pages (por clicks)
const topPages = await query({ dimensions: ["page"], rowLimit: 25 });

// 4. Oportunidades: páginas en pos 5-15 con muchas impresiones (potencial de subir al top 3)
const allPages = await query({ dimensions: ["page"], rowLimit: 500 });
const opportunities = allPages
  .filter((r) => r.position >= 5 && r.position <= 15 && r.impressions >= 50)
  .sort((a, b) => b.impressions - a.impressions)
  .slice(0, 20);

// 5. CTR bajo en top 10: title/meta a mejorar
const allQueries = await query({ dimensions: ["query"], rowLimit: 500 });
const lowCtr = allQueries
  .filter((r) => r.position <= 10 && r.ctr < 0.02 && r.impressions >= 100)
  .sort((a, b) => b.impressions - a.impressions)
  .slice(0, 20);

// 6. Por país
const byCountry = await query({ dimensions: ["country"], rowLimit: 10 });

// 7. Por device
const byDevice = await query({ dimensions: ["device"], rowLimit: 5 });

// 8. Pages + queries combinado para detectar mismatch (intent fallida)
const pageQuery = await query({ dimensions: ["page", "query"], rowLimit: 500 });
const pagesByLang = {
  ingles: pageQuery.filter((r) => r.keys[0].includes("ingles")).reduce((s, r) => s + r.clicks, 0),
  frances: pageQuery.filter((r) => r.keys[0].includes("frances")).reduce((s, r) => s + r.clicks, 0),
  aleman: pageQuery.filter((r) => r.keys[0].includes("aleman")).reduce((s, r) => s + r.clicks, 0),
  italiano: pageQuery.filter((r) => r.keys[0].includes("italiano")).reduce((s, r) => s + r.clicks, 0),
  portugues: pageQuery.filter((r) => r.keys[0].includes("portugues")).reduce((s, r) => s + r.clicks, 0),
  rumano: pageQuery.filter((r) => r.keys[0].includes("rumano")).reduce((s, r) => s + r.clicks, 0),
  catalan: pageQuery.filter((r) => r.keys[0].includes("catalan")).reduce((s, r) => s + r.clicks, 0),
  neerlandes: pageQuery.filter((r) => r.keys[0].includes("neerlandes")).reduce((s, r) => s + r.clicks, 0),
  noruego: pageQuery.filter((r) => r.keys[0].includes("noruego")).reduce((s, r) => s + r.clicks, 0),
  sueco: pageQuery.filter((r) => r.keys[0].includes("sueco")).reduce((s, r) => s + r.clicks, 0),
};

const out = [];
out.push(`# GSC Report — traduccionesjuradas.net`);
out.push(`\n**Periodo:** ${startDate} → ${endDate} (${DAYS} días)`);
out.push(`**Generado:** ${new Date().toISOString()}\n`);

out.push(`## 1. Totales`);
out.push(`- **Clicks:** ${totals.clicks}`);
out.push(`- **Impresiones:** ${totals.impressions}`);
out.push(`- **CTR:** ${pct(totals.ctr)}`);
out.push(`- **Posición media:** ${pos(totals.position)}\n`);

out.push(`## 2. Top 25 Queries (por clicks)`);
out.push(table(topQueries, [
  { label: "Query", get: (r) => r.keys[0] },
  { label: "Clicks", get: (r) => r.clicks },
  { label: "Impr.", get: (r) => r.impressions },
  { label: "CTR", get: (r) => pct(r.ctr) },
  { label: "Pos", get: (r) => pos(r.position) },
]));

out.push(`\n## 3. Top 25 Páginas (por clicks)`);
out.push(table(topPages, [
  { label: "Página", get: (r) => r.keys[0].replace("https://www.traduccionesjuradas.net", "") || "/" },
  { label: "Clicks", get: (r) => r.clicks },
  { label: "Impr.", get: (r) => r.impressions },
  { label: "CTR", get: (r) => pct(r.ctr) },
  { label: "Pos", get: (r) => pos(r.position) },
]));

out.push(`\n## 4. 🎯 Oportunidades — Páginas en posición 5-15 con ≥50 impresiones`);
out.push(`Estas páginas están "casi top". Mejorar contenido/links internos puede subirlas al top 3.\n`);
if (opportunities.length === 0) {
  out.push(`_(ninguna)_`);
} else {
  out.push(table(opportunities, [
    { label: "Página", get: (r) => r.keys[0].replace("https://www.traduccionesjuradas.net", "") || "/" },
    { label: "Impr.", get: (r) => r.impressions },
    { label: "Clicks", get: (r) => r.clicks },
    { label: "CTR", get: (r) => pct(r.ctr) },
    { label: "Pos", get: (r) => pos(r.position) },
  ]));
}

out.push(`\n## 5. ⚠️  Title/Meta a mejorar — Queries en top 10 con CTR <2% (≥100 impresiones)`);
out.push(`Estás en buena posición pero el snippet no convierte. Reescribir title/description.\n`);
if (lowCtr.length === 0) {
  out.push(`_(ninguna)_`);
} else {
  out.push(table(lowCtr, [
    { label: "Query", get: (r) => r.keys[0] },
    { label: "Impr.", get: (r) => r.impressions },
    { label: "Clicks", get: (r) => r.clicks },
    { label: "CTR", get: (r) => pct(r.ctr) },
    { label: "Pos", get: (r) => pos(r.position) },
  ]));
}

out.push(`\n## 6. Por país (top 10)`);
out.push(table(byCountry, [
  { label: "País", get: (r) => r.keys[0] },
  { label: "Clicks", get: (r) => r.clicks },
  { label: "Impr.", get: (r) => r.impressions },
  { label: "CTR", get: (r) => pct(r.ctr) },
  { label: "Pos", get: (r) => pos(r.position) },
]));

out.push(`\n## 7. Por dispositivo`);
out.push(table(byDevice, [
  { label: "Device", get: (r) => r.keys[0] },
  { label: "Clicks", get: (r) => r.clicks },
  { label: "Impr.", get: (r) => r.impressions },
  { label: "CTR", get: (r) => pct(r.ctr) },
  { label: "Pos", get: (r) => pos(r.position) },
]));

out.push(`\n## 8. Clicks por idioma (páginas /traductor-jurado-*)`);
const langRows = Object.entries(pagesByLang)
  .map(([lang, clicks]) => ({ lang, clicks }))
  .sort((a, b) => b.clicks - a.clicks);
out.push(table(langRows, [
  { label: "Idioma", get: (r) => r.lang },
  { label: "Clicks", get: (r) => r.clicks },
]));

const md = out.join("\n");
const outDir = resolve(ROOT, "qa/seo");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, `gsc-report-${endDate}.md`);
writeFileSync(outPath, md);
console.log(md);
console.log(`\n✅ Guardado en ${outPath.replace(ROOT + "/", "")}`);
