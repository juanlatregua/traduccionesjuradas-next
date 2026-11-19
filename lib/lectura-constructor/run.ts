import { createHash } from "node:crypto";
import type { Reading, ReadingContext, SourceFile } from "../lectura/index.ts";
import { PROMPT_VERSION } from "../lectura/prompt.ts";
import { workingFromReading } from "./documents.ts";
import { ActiveConflict, type FileRow, type LecturaStore, type LoteOutcome, type LoteSource, type LoteStatus } from "./store.ts";

export type SourceRef = { name: string; url: string; mimeType: string | null };

export type StartInput = {
  source: LoteSource;
  targetLang: string | null;
  sourceLang: string | null;
  notes: string | null;
  reread: boolean;
  by: string;
};

export type StartDeps = {
  store: LecturaStore;
  listFiles(source: LoteSource): Promise<SourceRef[]>;
  download(ref: SourceRef): Promise<Uint8Array>;
  /** `attempt` always comes from the stored lote, never from the request. */
  read(files: SourceFile[], context: ReadingContext, opts: { attempt: number }): Promise<Reading>;
  now(): Date;
  newId(): string;
};

export type StartResult =
  | { kind: "done"; loteId: string; status: LoteStatus; reused: boolean }
  | { kind: "busy"; loteId: string; attempt: number; maxRetries: number; reasonEs: string }
  | { kind: "in_progress"; loteId: string | null }
  | { kind: "no_files" };

/** A running lote untouched for longer than the route can live is considered dead and may be claimed again. */
export const STALE_RUNNING_MS = 6 * 60 * 1000;

export function fingerprintOf(refs: readonly SourceRef[], targetLang: string | null, sourceLang: string | null): string {
  const urls = [...new Set(refs.map((r) => r.url))].sort();
  return createHash("sha256").update(JSON.stringify([PROMPT_VERSION, targetLang ?? "", sourceLang ?? "", urls])).digest("hex");
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

function filesOfBatch(reading: Extract<Reading, { batch: unknown }>, inputs: { ref: SourceRef; sha256: string }[]): FileRow[] {
  const urlOf = (name: string, sha256: string) =>
    inputs.find((i) => i.sha256 === sha256)?.ref.url ?? inputs.find((i) => name.startsWith(i.ref.name))?.ref.url ?? null;
  const { batch } = reading;
  return [
    ...batch.files.map((f): FileRow => ({ position: f.index, name: f.name, url: urlOf(f.name, f.sha256), sha256: f.sha256, pageCount: f.pageCount, state: "ok", reasonEs: null })),
    ...batch.duplicateFiles.map((d): FileRow => ({ position: null, name: d.name, url: urlOf(d.name, d.sha256), sha256: d.sha256, pageCount: null, state: "duplicate", reasonEs: `copia exacta del archivo ${d.exactDuplicateOf}` })),
    ...batch.skipped.map((s): FileRow => ({ position: null, name: s.name, url: inputs.find((i) => i.ref.name === s.name)?.ref.url ?? null, sha256: null, pageCount: null, state: "skipped", reasonEs: s.reasonEs })),
  ];
}

const inputRows = (refs: readonly SourceRef[], state: FileRow["state"], reasonEs: string | null): FileRow[] =>
  refs.map((r) => ({ position: null, name: r.name, url: r.url, sha256: null, pageCount: null, state, reasonEs }));

const meterOf = (r: { attempts: number; usage: unknown; cost: unknown; ms: number; servedBy: string[] }) => ({ attempts: r.attempts, usage: r.usage, cost: r.cost, ms: r.ms, servedBy: r.servedBy });

export function outcomeOf(reading: Exclude<Reading, { status: "busy" }>, inputs: { ref: SourceRef; sha256: string }[], newId: () => string): LoteOutcome {
  const base = { targetLang: null, targetLangBasis: null, clean: null, reasons: null, reading: null, detailEs: null, cost: null, documents: [] };
  const refs = inputs.map((i) => i.ref);
  switch (reading.status) {
    case "ok":
    case "nothing_to_translate":
      return {
        ...base,
        status: reading.status,
        targetLang: reading.reading.targetLang,
        targetLangBasis: reading.reading.targetLangBasis,
        clean: reading.assessment.clean,
        reasons: reading.assessment.reasons,
        reading: reading.reading,
        cost: meterOf(reading),
        files: filesOfBatch(reading, inputs),
        documents: reading.status === "ok" ? workingFromReading(reading.documents, reading.assessment.reasons, newId) : [],
      };
    case "too_large":
      return { ...base, status: "too_large", detailEs: reading.reasonEs, files: inputRows(refs, "skipped", reading.reasonEs) };
    case "empty":
      return {
        ...base, status: "empty", detailEs: reading.reasonEs,
        files: reading.skipped.map((s) => ({ position: null, name: s.name, url: refs.find((r) => r.name === s.name)?.url ?? null, sha256: null, pageCount: null, state: "skipped" as const, reasonEs: s.reasonEs })),
      };
    case "refused":
      return { ...base, status: "refused", detailEs: reading.explanation ?? reading.category ?? "la lectura se ha negado", cost: meterOf(reading), files: filesOfBatch(reading, inputs) };
    case "truncated":
      return { ...base, status: "truncated", detailEs: `lectura cortada (${reading.stopReason})`, cost: meterOf(reading), files: filesOfBatch(reading, inputs) };
    case "invalid":
      return { ...base, status: "invalid", detailEs: reading.errors.slice(0, 5).join(" · "), reading: reading.reading, cost: meterOf(reading), files: filesOfBatch(reading, inputs) };
    case "error":
      return { ...base, status: "error", detailEs: `${reading.error.kind}: ${reading.error.message}`.slice(0, 500), cost: meterOf(reading), files: filesOfBatch(reading, inputs) };
  }
}

export async function startReading(deps: StartDeps, input: StartInput): Promise<StartResult> {
  const refs = await deps.listFiles(input.source);
  if (refs.length === 0) return { kind: "no_files" };
  const fingerprint = fingerprintOf(refs, input.targetLang, input.sourceLang);

  if (!input.reread) {
    const done = await deps.store.findLatestDone(fingerprint);
    if (done && (done.status === "ok" || done.status === "confirmed")) return { kind: "done", loteId: done.id, status: done.status, reused: true };
  }

  let lote = await deps.store.findActive(fingerprint);
  if (lote) {
    const staleBefore = new Date(deps.now().getTime() - STALE_RUNNING_MS);
    if (!(await deps.store.claim(lote.id, staleBefore))) return { kind: "in_progress", loteId: lote.id };
  } else {
    try {
      lote = await deps.store.createRunning({ ...input.source, fingerprint, targetLang: input.targetLang, promptVersion: PROMPT_VERSION, createdBy: input.by });
    } catch (err) {
      if (err instanceof ActiveConflict) return { kind: "in_progress", loteId: null };
      throw err;
    }
  }
  const attempt = lote.busyAttempts;

  const inputs: { ref: SourceRef; sha256: string; bytes: Uint8Array }[] = [];
  try {
    for (const ref of refs) {
      const bytes = await deps.download(ref);
      inputs.push({ ref, bytes, sha256: sha(bytes) });
    }
  } catch (err) {
    const detailEs = `no se pudo descargar un archivo: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500);
    await deps.store.finish(lote.id, { ...emptyOutcome("error", detailEs), files: inputRows(refs, "skipped", detailEs) });
    return { kind: "done", loteId: lote.id, status: "error", reused: false };
  }

  let reading: Reading;
  try {
    reading = await deps.read(
      inputs.map((i) => ({ name: i.ref.name, mimeType: i.ref.mimeType, bytes: i.bytes })),
      { declaredTargetLang: input.targetLang, declaredSourceLang: input.sourceLang, caseNotes: input.notes },
      { attempt },
    );
  } catch (err) {
    const detailEs = `fallo inesperado: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500);
    await deps.store.finish(lote.id, { ...emptyOutcome("error", detailEs), files: inputRows(refs, "skipped", detailEs) });
    return { kind: "done", loteId: lote.id, status: "error", reused: false };
  }

  if (reading.status === "busy") {
    await deps.store.markBusy(lote.id, reading.attempt, inputRows(refs, "busy", reading.reasonEs), reading.reasonEs);
    return { kind: "busy", loteId: lote.id, attempt: reading.attempt, maxRetries: reading.maxRetries, reasonEs: reading.reasonEs };
  }
  const read = outcomeOf(reading, inputs, deps.newId);
  const outcome = input.targetLang ? { ...read, targetLang: input.targetLang } : read;
  await deps.store.finish(lote.id, outcome);
  return { kind: "done", loteId: lote.id, status: outcome.status, reused: false };
}

function emptyOutcome(status: LoteOutcome["status"], detailEs: string): Omit<LoteOutcome, "files"> {
  return { status, targetLang: null, targetLangBasis: null, clean: null, reasons: null, reading: null, detailEs, cost: null, documents: [] };
}
