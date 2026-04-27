// scripts/gsc-inspect-all.mjs — Inspección de TODAS las URLs del sitemap deployed
// Reporta solo las que tienen problemas (no PASS / no Submitted and indexed)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createSign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITE = "sc-domain:traduccionesjuradas.net";
const BASE = "https://www.traduccionesjuradas.net";

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

console.log("Fetching sitemap...");
const sitemapXml = await (await fetch(BASE + "/sitemap.xml")).text();
const urls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`Found ${urls.length} URLs in sitemap\n`);

const token = await getToken();

async function inspect(url) {
  const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE }),
  });
  return r.json();
}

const all = [];
const problems = [];
for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  process.stdout.write(`[${i + 1}/${urls.length}] ${url.replace(BASE, "")}... `);
  try {
    const data = await inspect(url);
    if (data.error) {
      console.log(`❌ API ERROR: ${data.error.message?.slice(0, 60)}`);
      problems.push({ url, type: "api_error", detail: data.error.message });
      all.push({ url, error: data.error.message });
      continue;
    }
    const idx = data.inspectionResult?.indexStatusResult ?? {};
    const verdict = idx.verdict || "?";
    const coverage = idx.coverageState || "?";
    all.push({ url, verdict, coverage, idx });

    const isProblem =
      verdict !== "PASS" ||
      (coverage !== "Submitted and indexed" && coverage !== "Indexed, not submitted in sitemap") ||
      (idx.userCanonical && idx.googleCanonical && idx.userCanonical !== idx.googleCanonical) ||
      idx.pageFetchState === "REDIRECT_ERROR" ||
      idx.pageFetchState === "BLOCKED_ROBOTS_TXT" ||
      idx.pageFetchState === "NOT_FOUND" ||
      idx.pageFetchState === "SERVER_ERROR";

    if (isProblem) {
      console.log(`⚠️  ${verdict} | ${coverage}`);
      problems.push({
        url,
        type: "indexing",
        verdict,
        coverage,
        canonicalMismatch: idx.userCanonical !== idx.googleCanonical
          ? { user: idx.userCanonical, google: idx.googleCanonical }
          : null,
        pageFetch: idx.pageFetchState,
        lastCrawl: idx.lastCrawlTime,
        referring: (idx.referringUrls || []).slice(0, 3),
      });
    } else {
      console.log(`✅ ${verdict}`);
    }
  } catch (err) {
    console.log(`❌ ${err.message}`);
    problems.push({ url, type: "exception", detail: err.message });
  }
  await new Promise((r) => setTimeout(r, 150));
}

const out = [];
out.push(`# GSC Full Sitemap Inspection — ${new Date().toISOString().slice(0, 10)}`);
out.push(`\nInspeccionadas ${urls.length} URLs del sitemap deployed.`);
out.push(`Problemas detectados: **${problems.length}** (${((problems.length / urls.length) * 100).toFixed(1)}%)\n`);

const byType = {};
for (const p of problems) {
  const k = p.coverage || p.type;
  byType[k] = (byType[k] || 0) + 1;
}
out.push(`## Resumen por tipo de problema\n`);
out.push(`| Tipo | Count |`);
out.push(`| --- | --- |`);
for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  out.push(`| ${k} | ${v} |`);
}

out.push(`\n## URLs con problema\n`);
out.push(`| URL | Verdict | Coverage | Page fetch | Canonical mismatch |`);
out.push(`| --- | --- | --- | --- | --- |`);
for (const p of problems) {
  const path = p.url.replace(BASE, "");
  if (p.type === "api_error" || p.type === "exception") {
    out.push(`| ${path} | ❌ | ${p.detail?.slice(0, 50)} | - | - |`);
  } else {
    const can = p.canonicalMismatch
      ? `G→${p.canonicalMismatch.google?.replace(BASE, "") || "?"}`
      : "—";
    out.push(`| ${path} | ${p.verdict} | ${p.coverage} | ${p.pageFetch || "—"} | ${can} |`);
  }
}

out.push(`\n## Detalles\n`);
for (const p of problems) {
  if (p.type === "api_error" || p.type === "exception") continue;
  out.push(`### ${p.url.replace(BASE, "")}`);
  out.push(`- Verdict: ${p.verdict}`);
  out.push(`- Coverage: ${p.coverage}`);
  out.push(`- Page fetch: ${p.pageFetch}`);
  out.push(`- Last crawl: ${p.lastCrawl || "—"}`);
  if (p.canonicalMismatch) {
    out.push(`- ⚠️ Canonical mismatch:`);
    out.push(`  - User canonical: ${p.canonicalMismatch.user || "—"}`);
    out.push(`  - Google canonical: ${p.canonicalMismatch.google || "—"}`);
  }
  if (p.referring?.length) {
    out.push(`- Referring URLs: ${p.referring.join(", ")}`);
  }
  out.push("");
}

const md = out.join("\n");
const outPath = resolve(ROOT, "qa/seo", `gsc-inspect-all-${new Date().toISOString().slice(0, 10)}.md`);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, md);
console.log(`\n✅ Total: ${urls.length} | OK: ${urls.length - problems.length} | Problemas: ${problems.length}`);
console.log(`✅ Guardado en ${outPath.replace(ROOT + "/", "")}`);
