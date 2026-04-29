#!/usr/bin/env node
// gsc-low-ctr.mjs — queries con muchas impresiones y CTR bajo (oportunidades de mejorar title/meta)
// Uso: node scripts/seo/gsc-low-ctr.mjs [--days=28] [--min-impressions=20] [--max-ctr=0.02] [--limit=20] [--json]
import { gscQuery, dateRange, parseArgs, printTable, fmtPct, fmt } from "./_lib.mjs";

const args = parseArgs(process.argv);
const days = parseInt(args.days || "28", 10);
const minImp = parseInt(args["min-impressions"] || "20", 10);
const maxCtr = parseFloat(args["max-ctr"] || "0.02");
const limit = parseInt(args.limit || "20", 10);

const range = dateRange(days);
const data = await gscQuery({
  ...range,
  dimensions: ["query", "page"],
  rowLimit: 1000,
});

const filtered = (data.rows || [])
  .filter((r) => r.impressions >= minImp && r.ctr <= maxCtr)
  .sort((a, b) => b.impressions - a.impressions)
  .slice(0, limit);

if (args.json) {
  console.log(JSON.stringify(filtered, null, 2));
  process.exit(0);
}

console.log(
  `GSC low-CTR (≥${minImp} impr, ≤${(maxCtr * 100).toFixed(0)}% CTR) · ${range.startDate} → ${range.endDate}\n`,
);
printTable(filtered, [
  { label: "Query", get: (r) => r.keys[0] },
  { label: "Page", get: (r) => r.keys[1].replace("https://www.traduccionesjuradas.net", "") || "/" },
  { label: "Impr", get: (r) => r.impressions },
  { label: "Clicks", get: (r) => r.clicks },
  { label: "CTR", get: (r) => fmtPct(r.ctr) },
  { label: "Pos", get: (r) => fmt(r.position) },
]);
