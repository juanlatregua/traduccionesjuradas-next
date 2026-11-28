import type { BetaMessage, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { DEFAULT_LIMITS, prepareBatch, type BatchLimits, type Busy, type PreparedBatch, type SourceFile } from "./prepare.ts";
import { batchContent, buildRequest, callReading, defaultModelCall, messageUsages, retryMessages, READING_MODEL, type CallOptions, type ModelCall, type ReadError } from "./read.ts";
import { validateReading } from "./validate.ts";
import { billableWords, TEXT_PAGE_MIN_WORDS } from "./words.ts";
import { addUsage, costOf, ZERO_USAGE, DEFAULT_EUR_PER_USD, type Cost, type ModelUsage, type TokenUsage } from "./cost.ts";
import type { ModelReading, Part, ReadDocumentRaw } from "./schema.ts";
import type { ReadingContext } from "./prompt.ts";
import { assessReading, type Assessment } from "./assess.ts";
import { transcribeDocuments, transcribeOn, type TranscribeDeps, type Transcription, type WordsBasis } from "./transcribe.ts";
import { HeavyWorker } from "./heavy.ts";
import { ASSEMBLY_TIMEOUT_MS } from "./assemble.ts";

export type { SourceFile, PreparedBatch, BatchLimits, Busy } from "./prepare.ts";
export type { ReadingContext } from "./prompt.ts";
export type { ModelReading, Part, ReadDocumentRaw } from "./schema.ts";
export { prepareBatch, DEFAULT_LIMITS, MAX_BUSY_RETRIES } from "./prepare.ts";
export { validateReading } from "./validate.ts";
export { assembleDocumentPdfs, documentFileName, documentFileNames, type AssembledPdf } from "./assemble.ts";
export { documentLabel } from "./label.ts";
export { partitionOf, samePartition } from "./invariance.ts";
export { priceHint, type PriceHint } from "./price-hint.ts";
export { assessReading, type Assessment, type ReviewReason } from "./assess.ts";
export { costOf, MODEL_PRICES } from "./cost.ts";
export { PROMPT_VERSION } from "./prompt.ts";
export { transcribeOn, type Transcription, type WordsBasis } from "./transcribe.ts";

export type ReadDocument = ReadDocumentRaw & { pageCount: number; words: number; wordsBasis: WordsBasis; transcription?: Transcription };

type Meter = { attempts: number; usage: TokenUsage; usages: ModelUsage[]; cost: Cost; ms: number; servedBy: string[] };

export type Reading =
  | ({ status: "ok"; batch: PreparedBatch; reading: ModelReading; documents: ReadDocument[]; assessment: Assessment } & Meter)
  | ({ status: "nothing_to_translate"; batch: PreparedBatch; reading: ModelReading; assessment: Assessment } & Meter)
  | { status: "too_large"; limit: "files" | "pages" | "bytes"; max: number; actual: number; reasonEs: string }
  | { status: "empty"; reasonEs: string; skipped: PreparedBatch["skipped"] }
  | Busy
  | ({ status: "refused"; batch: PreparedBatch; category: string | null; explanation: string | null } & Meter)
  | ({ status: "truncated"; batch: PreparedBatch; stopReason: string } & Meter)
  | ({ status: "invalid"; batch: PreparedBatch; errors: string[]; reading: ModelReading | null } & Meter)
  | ({ status: "error"; batch: PreparedBatch; error: ReadError } & Meter);

export type ReadDeps = CallOptions & {
  callModel?: ModelCall;
  limits?: BatchLimits;
  /** Busy results this batch already got: pass back `attempt` from the last busy result; at MAX_BUSY_RETRIES files are skipped instead. */
  attempt?: number;
  eurPerUsd?: number;
  now?: () => number;
  /** Epoch ms by which the reading must be over; transcription (LECTURA_TRANSCRIBIR=on) only uses the time left before it. */
  deadlineAt?: number;
  transcribe?: Omit<TranscribeDeps, "deadlineAt" | "now">;
};

function exactWords(batch: PreparedBatch, doc: ReadDocumentRaw): number | null {
  const parts: Part[] = [...doc.parts, ...(doc.annexes ?? []).flatMap((a) => a.parts), ...(doc.apostille?.parts ?? [])];
  let total = 0;
  for (const p of parts) {
    const f = batch.files.find((x) => x.index === p.fileIndex);
    const n = f?.textLayer ? f.pageWords?.[p.page - 1] : undefined;
    if (n === undefined || n < TEXT_PAGE_MIN_WORDS) return null;
    total += n;
  }
  return billableWords(total, doc.isBilingualDuplicate);
}

export function withWords(batch: PreparedBatch, reading: ModelReading): ReadDocument[] {
  return reading.documents.map((d): ReadDocument => {
    const exact = exactWords(batch, d);
    return {
      ...d,
      pageCount: d.parts.length + (d.annexes ?? []).reduce((n, a) => n + a.parts.length, 0),
      words: exact ?? Math.max(0, Math.round(d.estimatedWords) || 0),
      wordsBasis: exact === null ? "estimated" : "exact",
    };
  });
}

export async function readBatch(files: readonly SourceFile[], context: ReadingContext, deps: ReadDeps = {}): Promise<Reading> {
  const now = deps.now ?? Date.now;
  const prepared = await prepareBatch(files, deps.limits ?? DEFAULT_LIMITS, deps.attempt ?? 0);
  if (prepared.status !== "ok") return prepared;
  const batch = prepared.batch;

  const call = deps.callModel ?? defaultModelCall();
  const model = deps.model ?? READING_MODEL;
  const started = now();
  const usages: ModelUsage[] = [];
  const servedBy = new Set<string>();
  const meter = (attempts: number): Meter => ({
    attempts,
    usage: usages.reduce<TokenUsage>((s, u) => addUsage(s, u), ZERO_USAGE),
    usages: [...usages],
    cost: costOf(usages, deps.eurPerUsd ?? DEFAULT_EUR_PER_USD),
    ms: now() - started,
    servedBy: [...servedBy],
  });
  const record = (m: BetaMessage) => {
    usages.push(...messageUsages(m, model));
    servedBy.add(m.model || model);
  };

  const first: BetaMessageParam[] = [{ role: "user", content: batchContent(batch, context) }];
  let messages = first;
  let lastReading: ModelReading | null = null;
  let errors: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const outcome = await callReading(call, buildRequest(messages, deps));
    if (outcome.kind === "error") return { status: "error", batch, error: outcome.error, ...meter(attempt) };
    record(outcome.message);
    if (outcome.kind === "refused") return { status: "refused", batch, category: outcome.category, explanation: outcome.explanation, ...meter(attempt) };
    if (outcome.kind === "truncated") return { status: "truncated", batch, stopReason: outcome.stopReason, ...meter(attempt) };
    if (outcome.kind === "unparseable") errors = [outcome.detail];
    else {
      lastReading = outcome.reading;
      errors = [...outcome.wireErrors, ...validateReading(batch, outcome.reading, context)];
      if (errors.length === 0) {
        let documents = withWords(batch, outcome.reading);
        if (transcribeOn()) {
          const limits = deps.limits ?? DEFAULT_LIMITS;
          const heavy = deps.transcribe?.heavy ?? new HeavyWorker({ memoryMb: limits.workerMemoryMb, rssCeilingMb: limits.rssCeilingMb, timeoutMs: ASSEMBLY_TIMEOUT_MS });
          try {
            const t = await transcribeDocuments(batch, documents, { ...deps.transcribe, heavy, deadlineAt: deps.deadlineAt, now });
            documents = t.documents;
            usages.push(...t.usages);
          } finally {
            if (!deps.transcribe?.heavy) await heavy.close();
          }
        }
        const assessment = assessReading(batch, { ...outcome.reading, documents });
        if (documents.length === 0) return { status: "nothing_to_translate", batch, reading: outcome.reading, assessment, ...meter(attempt) };
        return { status: "ok", batch, reading: outcome.reading, documents, assessment, ...meter(attempt) };
      }
    }
    messages = retryMessages(first, outcome.message, errors);
  }
  return { status: "invalid", batch, errors, reading: lastReading, ...meter(2) };
}
