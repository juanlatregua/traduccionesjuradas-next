#!/usr/bin/env node
// psi.mjs — PageSpeed Insights / Core Web Vitals para una URL
// Uso: node scripts/seo/psi.mjs <url> [--strategy=mobile|desktop] [--json]
// Si tienes PSI_API_KEY en el entorno se usa; si no, modo anónimo (sujeto a rate limit más bajo).
import { parseArgs } from "./_lib.mjs";

const args = parseArgs(process.argv);
const url = process.argv[2]?.startsWith("http")
  ? process.argv[2]
  : process.argv[2]
    ? `https://www.traduccionesjuradas.net${process.argv[2].startsWith("/") ? "" : "/"}${process.argv[2]}`
    : "https://www.traduccionesjuradas.net";
const strategy = (args.strategy || "mobile").toLowerCase();

const params = new URLSearchParams({
  url,
  strategy,
  category: "performance",
});
for (const c of ["accessibility", "best-practices", "seo"]) {
  params.append("category", c);
}
if (process.env.PSI_API_KEY) params.set("key", process.env.PSI_API_KEY);

const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;
const res = await fetch(endpoint);
if (!res.ok) {
  console.error("PSI error:", res.status, await res.text());
  process.exit(1);
}
const data = await res.json();

if (args.json) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

const cats = data.lighthouseResult?.categories || {};
const audits = data.lighthouseResult?.audits || {};
const fieldData = data.loadingExperience?.metrics || {};

console.log(`PSI · ${url} (${strategy})\n`);

console.log("Lighthouse:");
const labels = { performance: "Performance", accessibility: "A11y", "best-practices": "Best Practices", seo: "SEO" };
for (const [k, label] of Object.entries(labels)) {
  const score = cats[k]?.score;
  if (score != null) console.log(`  ${label.padEnd(18)} ${(score * 100).toFixed(0)}/100`);
}

console.log("\nCore Web Vitals (lab):");
const labMetrics = [
  ["LCP", "largest-contentful-paint"],
  ["INP (TBT)", "total-blocking-time"],
  ["CLS", "cumulative-layout-shift"],
  ["FCP", "first-contentful-paint"],
  ["Speed Index", "speed-index"],
  ["TTI", "interactive"],
];
for (const [label, id] of labMetrics) {
  const a = audits[id];
  if (a?.displayValue) console.log(`  ${label.padEnd(18)} ${a.displayValue}`);
}

if (Object.keys(fieldData).length) {
  console.log("\nCore Web Vitals (field — usuarios reales últimos 28d):");
  const fieldLabels = {
    LARGEST_CONTENTFUL_PAINT_MS: "LCP",
    INTERACTION_TO_NEXT_PAINT: "INP",
    CUMULATIVE_LAYOUT_SHIFT_SCORE: "CLS",
    FIRST_CONTENTFUL_PAINT_MS: "FCP",
    EXPERIMENTAL_TIME_TO_FIRST_BYTE: "TTFB",
  };
  for (const [k, label] of Object.entries(fieldLabels)) {
    const m = fieldData[k];
    if (m) {
      const val = k.includes("LAYOUT_SHIFT") ? (m.percentile / 100).toFixed(3) : `${m.percentile}ms`;
      console.log(`  ${label.padEnd(18)} ${val} (${m.category})`);
    }
  }
} else {
  console.log("\nCore Web Vitals (field): sin datos suficientes (CrUX requiere tráfico mínimo).");
}

const opps = Object.values(audits)
  .filter((a) => a.details?.type === "opportunity" && a.numericValue > 0)
  .sort((a, b) => b.numericValue - a.numericValue)
  .slice(0, 5);
if (opps.length) {
  console.log("\nTop oportunidades:");
  for (const o of opps) {
    console.log(`  ${(o.displayValue || "").padEnd(12)} ${o.title}`);
  }
}
