#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const INPUT_FILE = path.resolve(process.cwd(), "seo/urls_5xx.txt");
const BASE_URL = process.env.SEO_BASE_URL || "https://www.traduccionesjuradas.net";
const MAX_REDIRECTS = 10;
const TIMEOUT_MS = 15000;

function isHttpStatusRedirect(status) {
  return status >= 300 && status < 400;
}

function toAbsoluteUrl(raw) {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("/")) {
    return new URL(value, BASE_URL).toString();
  }

  return new URL(`/${value}`, BASE_URL).toString();
}

async function fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)",
      },
    });

    return {
      status: response.status,
      location: response.headers.get("location"),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function traceUrl(initialUrl) {
  const chain = [];
  let currentUrl = initialUrl;

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    const { status, location } = await fetchOnce(currentUrl);
    chain.push({
      url: currentUrl,
      status,
      location,
    });

    if (!isHttpStatusRedirect(status) || !location) {
      break;
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  if (chain.length > MAX_REDIRECTS) {
    throw new Error(`Redirect chain exceeds ${MAX_REDIRECTS} hops`);
  }

  return chain;
}

function summarizeResult(input, chain, error) {
  if (error) {
    return {
      input,
      initialStatus: "ERROR",
      location: "-",
      finalStatus: "ERROR",
      finalUrl: "-",
      hops: "-",
      ok: false,
      reason: error.message,
    };
  }

  const first = chain[0];
  const last = chain[chain.length - 1];
  const hops = Math.max(chain.length - 1, 0);
  const any5xx = chain.some((step) => step.status >= 500);
  const tooManyHops = hops > 1;

  let reason = "OK";
  let ok = true;

  if (any5xx) {
    ok = false;
    reason = "5xx detected";
  } else if (tooManyHops) {
    ok = false;
    reason = `redirect chain ${hops} hops`;
  }

  return {
    input,
    initialStatus: first.status,
    location: first.location || "-",
    finalStatus: last.status,
    finalUrl: last.url,
    hops,
    ok,
    reason,
  };
}

function printSummary(results) {
  const lines = [
    "URL | status | Location | status_final | url_final | saltos | resultado",
    "--- | --- | --- | --- | --- | --- | ---",
  ];

  for (const row of results) {
    lines.push(
      `${row.input} | ${row.initialStatus} | ${row.location} | ${row.finalStatus} | ${row.finalUrl} | ${row.hops} | ${row.reason}`,
    );
  }

  console.log(lines.join("\n"));
}

async function main() {
  let raw;

  try {
    raw = await readFile(INPUT_FILE, "utf8");
  } catch {
    console.error(`NO_VERIFICADO: missing input file ${INPUT_FILE}`);
    process.exitCode = 1;
    return;
  }

  const urls = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map(toAbsoluteUrl)
    .filter(Boolean);

  if (urls.length === 0) {
    console.error(`NO_VERIFICADO: ${INPUT_FILE} is empty`);
    process.exitCode = 1;
    return;
  }

  const results = [];

  for (const url of urls) {
    try {
      const chain = await traceUrl(url);
      results.push(summarizeResult(url, chain, null));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      results.push(summarizeResult(url, null, err));
    }
  }

  printSummary(results);

  const hasFailures = results.some((r) => !r.ok);
  if (hasFailures) {
    process.exitCode = 1;
  }
}

await main();
