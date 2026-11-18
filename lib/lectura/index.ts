import type { BetaMessage, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { DEFAULT_LIMITS, prepareBatch, type BatchLimits, type PreparedBatch, type SourceFile } from "./prepare.ts";
import { batchContent, buildRequest, callReading, defaultModelCall, messageUsages, retryMessages, READING_MODEL, type CallOptions, type ModelCall, type ReadError } from "./read.ts";
import { validateReading } from "./validate.ts";
import { billableWords, countWords, TEXT_PAGE_MIN_WORDS } from "./words.ts";
import { addUsage, costOf, ZERO_USAGE, DEFAULT_EUR_PER_USD, type Cost, type ModelUsage, type TokenUsage } from "./cost.ts";
import type { ModelReading, Part, ReadDocumentRaw } from "./schema.ts";
import type { ReadingContext } from "./prompt.ts";

export type { SourceFile, PreparedBatch, BatchLimits } from "./prepare.ts";
export type { ReadingContext } from "./prompt.ts";
export type { ModelReading, Part, ReadDocumentRaw } from "./schema.ts";
export { prepareBatch, DEFAULT_LIMITS } from "./prepare.ts";
export { validateReading } from "./validate.ts";
export { assembleDocumentPdf, documentFileName } from "./assemble.ts";
export { priceHint, type PriceHint } from "./price-hint.ts";
export { costOf, MODEL_PRICES } from "./cost.ts";
export { PROMPT_VERSION } from "./prompt.ts";

export type ReadDocument = ReadDocumentRaw & { pageCount: number; words: number; wordsBasis: "exact" | "estimated" };

type Meter = { attempts: number; usage: TokenUsage; usages: ModelUsage[]; cost: Cost; ms: number; servedBy: string[] };

export type Reading =
  | ({ status: "ok"; batch: PreparedBatch; reading: ModelReading; documents: ReadDocument[] } & Meter)
  | { status: "too_large"; limit: "files" | "pages" | "bytes"; max: number; actual: number; reasonEs: string }
  | { status: "empty"; reasonEs: string; skipped: PreparedBatch["skipped"] }
  | ({ status: "refused"; batch: PreparedBatch; category: string | null; explanation: string | null } & Meter)
  | ({ status: "truncated"; batch: PreparedBatch; stopReason: string } & Meter)
  | ({ status: "invalid"; batch: PreparedBatch; errors: string[]; reading: ModelReading | null } & Meter)
  | ({ status: "error"; batch: PreparedBatch; error: ReadError } & Meter);

export type ReadDeps = CallOptions & {
  callModel?: ModelCall;
  limits?: BatchLimits;
  eurPerUsd?: number;
  now?: () => number;
};

function exactWords(batch: PreparedBatch, doc: ReadDocumentRaw): number | null {
  const parts: Part[] = [...doc.parts, ...(doc.apostille?.parts ?? [])];
  let total = 0;
  for (const p of parts) {
    const f = batch.files.find((x) => x.index === p.fileIndex);
    const text = f?.textLayer ? f.pageTexts?.[p.page - 1] : undefined;
    if (text === undefined) return null;
    const n = countWords(text);
    if (n < TEXT_PAGE_MIN_WORDS) return null;
    total += n;
  }
  return billableWords(total, doc.isBilingualDuplicate);
}

export function withWords(batch: PreparedBatch, reading: ModelReading): ReadDocument[] {
  return reading.documents.map((d) => {
    const exact = exactWords(batch, d);
    return {
      ...d,
      pageCount: d.parts.length,
      words: exact ?? Math.max(0, Math.round(d.estimatedWords) || 0),
      wordsBasis: exact === null ? "estimated" : "exact",
    };
  });
}

export async function readBatch(files: readonly SourceFile[], context: ReadingContext, deps: ReadDeps = {}): Promise<Reading> {
  const now = deps.now ?? Date.now;
  const prepared = await prepareBatch(files, deps.limits ?? DEFAULT_LIMITS);
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
      errors = [...outcome.wireErrors, ...validateReading(batch, outcome.reading)];
      if (errors.length === 0) return { status: "ok", batch, reading: outcome.reading, documents: withWords(batch, outcome.reading), ...meter(attempt) };
    }
    messages = retryMessages(first, outcome.message, errors);
  }
  return { status: "invalid", batch, errors, reading: lastReading, ...meter(2) };
}
