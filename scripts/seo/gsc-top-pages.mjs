#!/usr/bin/env node
// gsc-top-pages.mjs — top páginas (URLs) en GSC
// Uso: node scripts/seo/gsc-top-pages.mjs [--days=28] [--limit=20] [--json]
import { gscQuery, dateRange, parseArgs, printTable, fmtPct, fmt } from "./_lib.mjs";

const args = parseArgs(process.argv);
const days = parseInt(args.days || "28", 10);
const limit = parseInt(args.limit || "20", 10);

const range = dateRange(days);
const data = await gscQuery({
  ...range,
  dimensions: ["page"],
  rowLimit: limit,
});

if (args.json) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

console.log(`GSC top pages · ${range.startDate} → ${range.endDate}\n`);
printTable(data.rows || [], [
  { label: "Page", get: (r) => r.keys[0].replace("https://www.traduccionesjuradas.net", "") || "/" },
  { label: "Clicks", get: (r) => r.clicks },
  { label: "Impr", get: (r) => r.impressions },
  { label: "CTR", get: (r) => fmtPct(r.ctr) },
  { label: "Pos", get: (r) => fmt(r.position) },
]);
