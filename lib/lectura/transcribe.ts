import { defaultCallModel, SCAN_TOTAL_BUDGET_MS, transcribeScannedPdf, type ScanCallInput, type ScanCallOutput, type ScanDeps, type ScanResult } from "../ai/transcribe-scan.ts";
import { ASSEMBLY_TIMEOUT_MS, assembleDocumentPdfs, type AssembledPdf } from "./assemble.ts";
import type { HeavyWorker } from "./heavy.ts";
import type { ModelUsage } from "./cost.ts";
import type { PreparedBatch } from "./prepare.ts";
import type { ReadDocumentRaw } from "./schema.ts";
import { billableWords, countWords } from "./words.ts";

// Scans and photos: every page is transcribed (lib/ai/transcribe-scan.ts) and the text counted like Word, instead of
// trusting the reading's estimate. A page that cannot be transcribed keeps its share of the estimate and goes to a person.

export const TRANSCRIBE_MIN_BUDGET_MS = 10_000;
export const TRANSCRIBE_DEADLINE_MARGIN_MS = 10_000;
export const ASSEMBLY_MIN_MS = 5_000;
/** Model calls in flight for the whole batch, every document together. */
export const TRANSCRIBE_CONCURRENCY = 6;
const CALL_MIN_MS = 5_000;

export function transcribeOn(env: Record<string, string | undefined> = process.env): boolean {
  return (env.LECTURA_TRANSCRIBIR || "").trim().toLowerCase() === "on";
}

export type WordsBasis = "exact" | "estimated" | "transcribed";

export type Transcription = {
  complete: boolean;
  /** Billable words transcribed (bilingual duplicates halved), without the estimated share of failed pages. */
  words: number;
  perPage: number[];
  lowPages: number[];
  failedPages: number[];
  blockPages: number[];
  model: string | null;
  ms: number;
  detailEs: string | null;
};

type Doc = ReadDocumentRaw & { pageCount: number; words: number; wordsBasis: WordsBasis; transcription?: Transcription };

export type TranscribeDeps = {
  scan?: Omit<ScanDeps, "countWords">;
  heavy?: HeavyWorker;
  deadlineAt?: number;
  model?: string;
  now?: () => number;
};

const pagesEs = (pages: number[]) => pages.join(", ");

/** One queue of model calls for the whole batch; a call that waited is cut to what is left until `endAt`. */
export function sharedCalls(call: (input: ScanCallInput) => Promise<ScanCallOutput>, limit: number, endAt: number, now: () => number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async (input: ScanCallInput): Promise<ScanCallOutput> => {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      const left = endAt - now();
      if (left < CALL_MIN_MS) throw new Error("presupuesto de tiempo agotado");
      return await call({ ...input, timeoutMs: Math.min(input.timeoutMs, left) });
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

function notTranscribed(detailEs: string): Transcription {
  return { complete: false, words: 0, perPage: [], lowPages: [], failedPages: [], blockPages: [], model: null, ms: 0, detailEs };
}

export function applyScan<D extends Doc>(d: D, scan: ScanResult): D {
  const pages = scan.perPage.length;
  const transcribed = billableWords(scan.totalWords, d.isBilingualDuplicate);
  const base = { perPage: scan.perPage, lowPages: scan.lowPages, failedPages: scan.failedPages, blockPages: scan.blockPages, model: scan.model, ms: scan.ms };
  if (pages > 0 && scan.failedPages.length === 0) {
    return { ...d, words: transcribed, wordsBasis: "transcribed", transcription: { ...base, complete: true, words: transcribed, detailEs: null } };
  }
  const share = pages > 0 ? Math.round((d.words * scan.failedPages.length) / pages) : d.words;
  return {
    ...d,
    words: transcribed + share,
    wordsBasis: "estimated",
    transcription: { ...base, complete: false, words: transcribed, detailEs: `página(s) ${pagesEs(scan.failedPages)} sin transcribir: para ellas se queda la estimación` },
  };
}

export async function transcribeDocuments<D extends Doc>(
  batch: Pick<PreparedBatch, "files">,
  documents: readonly D[],
  deps: TranscribeDeps = {},
): Promise<{ documents: D[]; usages: ModelUsage[] }> {
  const now = deps.now ?? Date.now;
  const out = [...documents];
  const targets = documents.flatMap((d, i) => (d.wordsBasis === "estimated" ? [i] : []));
  if (targets.length === 0) return { documents: out, usages: [] };
  const mark = (detailEs: string) => {
    for (const i of targets) out[i] = { ...out[i], transcription: notTranscribed(detailEs) };
    return { documents: out, usages: [] };
  };
  const left = () => (deps.deadlineAt === undefined ? Infinity : deps.deadlineAt - now() - TRANSCRIBE_DEADLINE_MARGIN_MS);
  const budget = () => Math.min(SCAN_TOTAL_BUDGET_MS, left());
  if (left() < ASSEMBLY_MIN_MS + TRANSCRIBE_MIN_BUDGET_MS) return mark("sin tiempo para transcribir: se queda la estimación");

  let pdfs: AssembledPdf[];
  try {
    const assemblyMs = Math.min(ASSEMBLY_TIMEOUT_MS, left() - TRANSCRIBE_MIN_BUDGET_MS);
    pdfs = await assembleDocumentPdfs(batch, targets.map((i) => documents[i]), deps.heavy, assemblyMs);
  } catch (err) {
    return mark(`no se pudieron preparar las páginas para transcribir (${err instanceof Error ? err.message : String(err)}): se queda la estimación`);
  }
  const totalBudgetMs = budget();
  if (totalBudgetMs < TRANSCRIBE_MIN_BUDGET_MS) return mark("sin tiempo para transcribir: se queda la estimación");

  const usages: ModelUsage[] = [];
  const callModel = sharedCalls(deps.scan?.callModel ?? defaultCallModel, TRANSCRIBE_CONCURRENCY, now() + totalBudgetMs, now);
  await Promise.all(targets.map(async (i, k) => {
    const pdf = pdfs[k];
    if (!pdf.ok) {
      out[i] = { ...out[i], transcription: notTranscribed(`no se pudieron preparar las páginas para transcribir (${pdf.reasonEs}): se queda la estimación`) };
      return;
    }
    try {
      const scan = await transcribeScannedPdf(Buffer.from(pdf.bytes), { pageCount: pdf.pageCount, totalBudgetMs, model: deps.model }, { ...deps.scan, callModel, countWords });
      usages.push({ model: scan.model, input: scan.usage.input, output: scan.usage.output, cacheRead: 0, cacheWrite: 0 });
      out[i] = applyScan(out[i], scan);
    } catch (err) {
      out[i] = { ...out[i], transcription: notTranscribed(`la transcripción ha fallado (${err instanceof Error ? err.message : String(err)}): se queda la estimación`) };
    }
  }));
  return { documents: out, usages };
}
