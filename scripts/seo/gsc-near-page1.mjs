#!/usr/bin/env node
// gsc-near-page1.mjs — queries en posición 11-20 (página 2): empujones para llevarlas a página 1
// Uso: node scripts/seo/gsc-near-page1.mjs [--days=28] [--min-position=11] [--max-position=20] [--min-impressions=5] [--limit=20] [--json]
import { gscQuery, dateRange, parseArgs, printTable, fmtPct, fmt } from "./_lib.mjs";

const args = parseArgs(process.argv);
const days = parseInt(args.days || "28", 10);
const minPos = parseFloat(args["min-position"] || "11");
const maxPos = parseFloat(args["max-position"] || "20");
const minImp = parseInt(args["min-impressions"] || "5", 10);
const limit = parseInt(args.limit || "20", 10);

const range = dateRange(days);
const data = await gscQuery({
  ...range,
  dimensions: ["query", "page"],
  rowLimit: 1000,
});

const filtered = (data.rows || [])
  .filter((r) => r.position >= minPos && r.position <= maxPos && r.impressions >= minImp)
  .sort((a, b) => a.position - b.position)
  .slice(0, limit);

if (args.json) {
  console.log(JSON.stringify(filtered, null, 2));
  process.exit(0);
}

console.log(
  `GSC near page 1 (pos ${minPos}-${maxPos}, ≥${minImp} impr) · ${range.startDate} → ${range.endDate}\n`,
);
printTable(filtered, [
  { label: "Query", get: (r) => r.keys[0] },
  { label: "Page", get: (r) => r.keys[1].replace("https://www.traduccionesjuradas.net", "") || "/" },
  { label: "Pos", get: (r) => fmt(r.position) },
  { label: "Impr", get: (r) => r.impressions },
  { label: "Clicks", get: (r) => r.clicks },
  { label: "CTR", get: (r) => fmtPct(r.ctr) },
]);
