import type { WorkingDocument } from "./documents.ts";
import type { LectureFile } from "./lines.ts";

export type LoteStatus =
  | "running" | "busy" | "ok" | "nothing_to_translate" | "too_large" | "empty"
  | "refused" | "truncated" | "invalid" | "error" | "confirmed";

export const TERMINAL: ReadonlySet<LoteStatus> = new Set(["ok", "nothing_to_translate", "too_large", "empty", "refused", "truncated", "invalid", "error", "confirmed"]);

export type FileRow = LectureFile & { sha256: string | null; state: "ok" | "skipped" | "duplicate" | "busy"; reasonEs: string | null };

export type LoteSource = { casoId: string | null; sessionKey: string | null; quoteId: string | null };

export type LoteRow = LoteSource & {
  id: string;
  fingerprint: string;
  activeKey: string | null;
  status: LoteStatus;
  busyAttempts: number;
  targetLang: string | null;
  targetLangBasis: string | null;
  promptVersion: string;
  clean: boolean | null;
  reasons: unknown;
  detailEs: string | null;
  createdBy: string;
  confirmedBy: string | null;
  confirmedAt: Date | null;
  lines: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type LoteOutcome = {
  status: Exclude<LoteStatus, "running" | "busy" | "confirmed">;
  targetLang: string | null;
  targetLangBasis: string | null;
  clean: boolean | null;
  reasons: unknown;
  reading: unknown;
  detailEs: string | null;
  cost: unknown;
  files: FileRow[];
  documents: WorkingDocument[];
};

export type LecturaStore = {
  findActive(fingerprint: string): Promise<LoteRow | null>;
  findLatestDone(fingerprint: string): Promise<LoteRow | null>;
  /** Fails with ActiveConflict when another lote already holds this fingerprint. */
  createRunning(input: LoteSource & { fingerprint: string; targetLang: string | null; promptVersion: string; createdBy: string }): Promise<LoteRow>;
  /** running again only if the lote is still busy, or running but not touched since `staleBefore`. */
  claim(id: string, staleBefore: Date): Promise<boolean>;
  markBusy(id: string, attempts: number, files: FileRow[], detailEs: string): Promise<void>;
  finish(id: string, outcome: LoteOutcome): Promise<void>;
  get(id: string): Promise<{ lote: LoteRow; files: FileRow[]; documents: WorkingDocument[] } | null>;
  /** Only while the lote is «ok» (not confirmed): false otherwise. */
  replaceDocuments(id: string, documents: WorkingDocument[]): Promise<boolean>;
  confirm(id: string, by: string, lines: unknown): Promise<boolean>;
  linkQuote(id: string, quoteId: string): Promise<void>;
  /** Only while the lote is «ok». */
  setTargetLang(id: string, targetLang: string): Promise<boolean>;
};

export class ActiveConflict extends Error {}
