// scripts/gsc-thin-check.mjs — Decisión #1 del sunset WP: ¿tienen equity las 6 thin?
// Search Analytics (90d) + URL Inspection para los slugs raíz a fusionar.
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITE = "sc-domain:traduccionesjuradas.net";
const BASE = "https://www.traduccionesjuradas.net";

const SLUGS = [
  "/traduccion-jurada-de-estatutos-sociales",
  "/traduccion-jurada-antecedentes-penales",
  "/traduccion-jurada-permiso-de-conducir",
  "/traduccion-jurada-sentencia-judicial",
  "/traduccion-jurada-de-escritura-notarial",
  "/traduccion-jurada-de-certificado-de-seguridad-social",
];

const env = readFileSync(resolve(ROOT, ".env.local"), "utf8");
const sa = JSON.parse(env.match(/GOOGLE_VISION_SERVICE_ACCOUNT_JSON='([\s\S]+?)'\n/)[1]);

const b64u = (s) =>
  Buffer.from(s).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64u(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );
  const input = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(input);
  const sig = signer
    .sign(sa.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
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
const auth = { Authorization: `Bearer ${token}` };
const end = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
const start = new Date(Date.now() - 92 * 86400000).toISOString().slice(0, 10);

// 1) Search Analytics — impresiones/clics por página (90d), filtrado a los 6 slugs.
const saRes = await fetch(
  `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`,
  {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      startDate: start,
      endDate: end,
      dimensions: ["page"],
      rowLimit: 25000,
    }),
  }
);
const saData = await saRes.json();
const rows = saData.rows || [];
const byPage = new Map(rows.map((r) => [r.keys[0], r]));

console.log(`\n=== Search Analytics ${start} → ${end} (90d) ===`);
for (const slug of SLUGS) {
  const url = BASE + slug;
  const r = byPage.get(url) || byPage.get(url + "/");
  if (r) {
    console.log(
      `IMPR  ${slug}\n      clicks=${r.clicks} impr=${r.impressions} pos=${r.position.toFixed(1)} ctr=${(r.ctr * 100).toFixed(1)}%`
    );
  } else {
    console.log(`ZERO  ${slug}  → 0 impresiones en 90d`);
  }
}

// 2) URL Inspection — estado de indexación de cada slug.
console.log(`\n=== URL Inspection (estado de indexación) ===`);
for (const slug of SLUGS) {
  const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl: BASE + slug, siteUrl: SITE }),
  });
  const d = await r.json();
  const idx = d.inspectionResult?.indexStatusResult;
  if (idx) {
    console.log(
      `${slug}\n      verdict=${idx.verdict} coverage="${idx.coverageState}" lastCrawl=${idx.lastCrawlTime || "—"} referring=${idx.referringUrls?.length ?? 0}`
    );
  } else {
    console.log(`${slug}\n      (sin resultado) ${JSON.stringify(d).slice(0, 160)}`);
  }
  await new Promise((res) => setTimeout(res, 600));
}
console.log();
