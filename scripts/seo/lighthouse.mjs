#!/usr/bin/env node
// lighthouse.mjs — corre Lighthouse local (Chrome headless) sin necesidad de API key
// Uso: node scripts/seo/lighthouse.mjs <url-o-path> [--strategy=mobile|desktop]
import { execFileSync } from "node:child_process";
import { parseArgs } from "./_lib.mjs";

const args = parseArgs(process.argv);
const target = process.argv[2] || "/";
const url = target.startsWith("http")
  ? target
  : `https://www.traduccionesjuradas.net${target.startsWith("/") ? "" : "/"}${target}`;
const strategy = (args.strategy || "mobile").toLowerCase();
const formFactor = strategy === "desktop" ? "desktop" : "mobile";

const cmd = [
  "lighthouse",
  url,
  "--quiet",
  "--chrome-flags=--headless=new",
  "--output=json",
  "--output-path=stdout",
  `--form-factor=${formFactor}`,
  "--only-categories=performance,accessibility,best-practices,seo",
];
if (formFactor === "desktop") cmd.push("--preset=desktop");

const json = execFileSync("npx", ["--yes", ...cmd], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
const data = JSON.parse(json);

if (args.json) {
  console.log(json);
  process.exit(0);
}

const cats = data.categories || {};
const audits = data.audits || {};
console.log(`Lighthouse · ${url} (${formFactor})\n`);

const labels = { performance: "Performance", accessibility: "A11y", "best-practices": "Best Practices", seo: "SEO" };
for (const [k, label] of Object.entries(labels)) {
  const score = cats[k]?.score;
  if (score != null) console.log(`  ${label.padEnd(18)} ${(score * 100).toFixed(0)}/100`);
}

console.log("\nCore Web Vitals (lab):");
for (const [label, id] of [
  ["LCP", "largest-contentful-paint"],
  ["TBT", "total-blocking-time"],
  ["CLS", "cumulative-layout-shift"],
  ["FCP", "first-contentful-paint"],
  ["Speed Index", "speed-index"],
  ["TTI", "interactive"],
]) {
  const a = audits[id];
  if (a?.displayValue) console.log(`  ${label.padEnd(18)} ${a.displayValue}`);
}

const opps = Object.values(audits)
  .filter((a) => a.details?.type === "opportunity" && a.numericValue > 0)
  .sort((a, b) => b.numericValue - a.numericValue)
  .slice(0, 5);
if (opps.length) {
  console.log("\nTop oportunidades:");
  for (const o of opps) console.log(`  ${(o.displayValue || "").padEnd(14)} ${o.title}`);
}
