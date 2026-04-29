// scripts/seo/_lib.mjs — helpers para llamar APIs de Google con la SA via gcloud
import { execFileSync } from "node:child_process";

export const SITE = "sc-domain:traduccionesjuradas.net";
const SITE_ENC = encodeURIComponent(SITE);

export function getToken(scope) {
  try {
    return execFileSync("gcloud", ["auth", "print-access-token", `--scopes=${scope}`], {
      encoding: "utf8",
    }).trim();
  } catch (e) {
    console.error("gcloud auth failed. Activate the SA first:");
    console.error("  gcloud auth activate-service-account --key-file=~/.config/gcloud-sa/traducciones.json");
    process.exit(1);
  }
}

export function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.+))?$/);
    if (m) args[m[1]] = m[2] ?? true;
  }
  return args;
}

export function dateRange(daysAgo, lagDays = 3) {
  // GSC tiene latencia de ~2-3 días. End date = hoy - lagDays para no introducir días incompletos.
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - lagDays);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - daysAgo);
  return { startDate: iso(start), endDate: iso(end) };
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

export async function gscQuery(body) {
  const token = getToken("https://www.googleapis.com/auth/webmasters.readonly");
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${SITE_ENC}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    console.error("GSC API error:", res.status, await res.text());
    process.exit(1);
  }
  return res.json();
}

export function printTable(rows, columns) {
  if (!rows.length) {
    console.log("(sin datos)");
    return;
  }
  const widths = columns.map((c) => Math.max(c.label.length, ...rows.map((r) => String(c.get(r)).length)));
  const line = columns.map((c, i) => c.label.padEnd(widths[i])).join("  ");
  console.log(line);
  console.log(widths.map((w) => "-".repeat(w)).join("  "));
  for (const r of rows) {
    console.log(columns.map((c, i) => String(c.get(r)).padEnd(widths[i])).join("  "));
  }
}

export function fmt(n, d = 2) {
  return typeof n === "number" ? n.toFixed(d) : n;
}

export function fmtPct(n) {
  return (n * 100).toFixed(2) + "%";
}
