// lib/seo-indexing.ts — Inspecciona las URLs del sitemap contra la URL Inspection
// API de GSC y clasifica cuáles hay que pedir a mano en Search Console
// ("Solicitar indexación"): sin indexar, o rastreadas antes del último cambio.

import { getAccessToken, inspectUrl } from "@/lib/gsc";
import sitemap from "@/app/sitemap";

export type IndexingItem = {
  url: string;
  coverageState: string;
  lastCrawlTime: string | null;
  lastModified: string | null;
  priority: number;
};

export type IndexingReport = {
  total: number;
  checked: number;
  notIndexed: IndexingItem[];
  stale: IndexingItem[];
  // Google eligió como canónica una URL de OTRO dominio (Senegal → 747live.bet, 28-sep-2026).
  foreignCanonical: { url: string; googleCanonical: string }[];
  errors: string[];
};

const CONCURRENCY = 5;
// La Inspection API tarda 6-35 s por URL: se corta a los 200 s para que el cron
// (maxDuration 300) mande el email con lo revisado en vez de morir sin email.
const TIME_BUDGET_MS = 200_000;

function toDateOnly(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
}

function sortItems(items: IndexingItem[]): IndexingItem[] {
  return [...items].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const ac = a.lastCrawlTime;
    const bc = b.lastCrawlTime;
    if (!ac && bc) return -1;
    if (ac && !bc) return 1;
    if (!ac || !bc) return 0;
    return ac.localeCompare(bc);
  });
}

export async function buildIndexingReport(): Promise<IndexingReport> {
  // Si el tiempo no llega para todas, cada semana se empieza por otro tramo del
  // sitemap: en 2-3 semanas se cubren las 128.
  const all = sitemap();
  const start = (Math.floor(Date.now() / 604_800_000) * 60) % Math.max(all.length, 1);
  const entries = [...all.slice(start), ...all.slice(0, start)];
  const token = await getAccessToken();
  const deadline = Date.now() + TIME_BUDGET_MS;

  const notIndexed: IndexingItem[] = [];
  const stale: IndexingItem[] = [];
  const foreignCanonical: { url: string; googleCanonical: string }[] = [];
  const errors: string[] = [];
  let checked = 0;
  let idx = 0;

  async function worker() {
    while (idx < entries.length && Date.now() < deadline) {
      const i = idx++;
      const entry = entries[i];
      const url = entry.url;
      const lastModified = toDateOnly(entry.lastModified as Date | string | undefined);
      const priority = typeof entry.priority === "number" ? entry.priority : 0.5;
      try {
        const result = await inspectUrl(url, token);
        checked++;
        const lastCrawlDate = toDateOnly(result.lastCrawlTime);
        const item: IndexingItem = {
          url,
          coverageState: result.coverageState,
          lastCrawlTime: result.lastCrawlTime,
          lastModified,
          priority,
        };
        if (result.googleCanonical && hostOf(result.googleCanonical) !== hostOf(url)) {
          foreignCanonical.push({ url, googleCanonical: result.googleCanonical });
        }
        if (result.verdict !== "PASS") {
          notIndexed.push(item);
        } else if (lastModified && lastCrawlDate && lastCrawlDate < lastModified) {
          stale.push(item);
        }
      } catch (err: any) {
        if (errors.length < 5) errors.push(err?.message || String(err));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, () => worker()));

  return {
    total: entries.length,
    checked,
    notIndexed: sortItems(notIndexed),
    stale: sortItems(stale),
    foreignCanonical,
    errors,
  };
}
