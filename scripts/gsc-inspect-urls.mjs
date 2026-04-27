// scripts/gsc-inspect-urls.mjs — URL Inspection API: estado de indexación de páginas críticas
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createSign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITE = "sc-domain:traduccionesjuradas.net";
const BASE = "https://www.traduccionesjuradas.net";

const URLS = [
  // 10 idiomas (problema: 0 clicks)
  "/traductor-jurado-frances",
  "/traductor-jurado-ingles",
  "/traductor-jurado-aleman",
  "/traductor-jurado-italiano",
  "/traductor-jurado-portugues",
  "/traductor-jurado-rumano",
  "/traductor-jurado-catalan",
  "/traductor-jurado-neerlandes",
  "/traductor-jurado-noruego",
  "/traductor-jurado-sueco",
  // Home + 4 quick wins
  "/",
  "/blog/documentos-marroquies-guia-completa",
  "/blog/homologacion-titulo-universitario",
  "/blog/nacionalidad-espanola-documentos",
  "/traducciones-juradas-baratas",
];

const env = readFileSync(resolve(ROOT, ".env.local"), "utf8");
const sa = JSON.parse(env.match(/GOOGLE_VISION_SERVICE_ACCOUNT_JSON='([\s\S]+?)'\n/)[1]);

function b64u(s) { return Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_"); }
async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64u(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600, iat: now,
  }));
  const input = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  const sig = signer.sign(sa.private_key, "base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${input}.${sig}` }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error(JSON.stringify(d));
  return d.access_token;
}

const token = await getToken();

async function inspect(path) {
  const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl: BASE + path, siteUrl: SITE }),
  });
  return r.json();
}

const results = [];
for (const path of URLS) {
  process.stdout.write(`Inspecting ${path}... `);
  const data = await inspect(path);
  if (data.error) {
    console.log(`❌ ${data.error.message}`);
    results.push({ path, error: data.error.message });
  } else {
    const idx = data.inspectionResult?.indexStatusResult ?? {};
    console.log(`${idx.verdict || "?"} | cov: ${idx.coverageState || "?"}`);
    results.push({
      path,
      verdict: idx.verdict,
      coverage: idx.coverageState,
      indexingState: idx.indexingState,
      crawledAs: idx.crawledAs,
      lastCrawl: idx.lastCrawlTime,
      googleCanonical: idx.googleCanonical,
      userCanonical: idx.userCanonical,
      pageFetchState: idx.pageFetchState,
      robotsTxtState: idx.robotsTxtState,
      referringUrls: (idx.referringUrls || []).slice(0, 3),
      sitemap: idx.sitemap,
    });
  }
  await new Promise((r) => setTimeout(r, 200)); // throttle
}

const out = [];
out.push(`# GSC URL Inspection — ${new Date().toISOString().slice(0, 10)}`);
out.push(`\nInspeccionadas ${URLS.length} páginas críticas.\n`);

out.push(`## Resumen rápido\n`);
out.push(`| URL | Verdict | Coverage | Indexing | Last crawl | Canonical OK |`);
out.push(`| --- | --- | --- | --- | --- | --- |`);
for (const r of results) {
  if (r.error) {
    out.push(`| ${r.path} | ❌ ERROR | ${r.error} | - | - | - |`);
    continue;
  }
  const canOk = !r.userCanonical || !r.googleCanonical
    ? "?"
    : r.userCanonical === r.googleCanonical ? "✅" : `❌ G→${r.googleCanonical?.replace(BASE, "")}`;
  const crawl = r.lastCrawl ? r.lastCrawl.slice(0, 10) : "—";
  out.push(`| ${r.path} | ${r.verdict || "?"} | ${r.coverage || "?"} | ${r.indexingState || "?"} | ${crawl} | ${canOk} |`);
}

out.push(`\n## Detalles por URL\n`);
for (const r of results) {
  out.push(`### ${r.path}`);
  if (r.error) {
    out.push(`- ❌ Error: ${r.error}\n`);
    continue;
  }
  out.push(`- **Verdict:** ${r.verdict}`);
  out.push(`- **Coverage:** ${r.coverage}`);
  out.push(`- **Indexing:** ${r.indexingState}`);
  out.push(`- **Crawled as:** ${r.crawledAs}`);
  out.push(`- **Page fetch:** ${r.pageFetchState}`);
  out.push(`- **Robots.txt:** ${r.robotsTxtState}`);
  out.push(`- **Last crawl:** ${r.lastCrawl}`);
  out.push(`- **User canonical:** ${r.userCanonical || "—"}`);
  out.push(`- **Google canonical:** ${r.googleCanonical || "—"}`);
  out.push(`- **Sitemap:** ${r.sitemap?.[0] || "—"}`);
  out.push(`- **Referring URLs:** ${r.referringUrls?.join(", ") || "—"}\n`);
}

const md = out.join("\n");
const outPath = resolve(ROOT, "qa/seo", `gsc-inspect-${new Date().toISOString().slice(0, 10)}.md`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, md);
console.log(`\n✅ Guardado en ${outPath.replace(ROOT + "/", "")}`);
