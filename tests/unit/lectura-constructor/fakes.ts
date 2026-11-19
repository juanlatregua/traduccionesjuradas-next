import type { WorkingDocument } from "../../../lib/lectura-constructor/documents.ts";
import { ActiveConflict, type FileRow, type LecturaStore, type LoteRow } from "../../../lib/lectura-constructor/store.ts";
import { doc } from "../lectura/fixtures.ts";
import type { ReadDocumentRaw } from "../../../lib/lectura/schema.ts";

type Entry = { lote: LoteRow; files: FileRow[]; documents: WorkingDocument[] };

let tick = Date.parse("2026-11-19T09:00:00Z");
const ticking = () => new Date((tick += 1000));

export function memoryStore(clock: () => Date = ticking) {
  const rows = new Map<string, Entry>();
  let seq = 0;
  const calls: string[] = [];
  const touch = (e: Entry) => (e.lote.updatedAt = clock());
  const store: LecturaStore = {
    async findActive(fp) {
      for (const e of rows.values()) if (e.lote.activeKey === fp) return { ...e.lote };
      return null;
    },
    async findLatestDone(fp) {
      const done = [...rows.values()].filter((e) => e.lote.fingerprint === fp && e.lote.activeKey === null);
      return done.length ? { ...done[done.length - 1].lote } : null;
    },
    async createRunning(input) {
      for (const e of rows.values()) if (e.lote.activeKey === input.fingerprint) throw new ActiveConflict("dup");
      const id = `L${++seq}`;
      const now = clock();
      const lote: LoteRow = {
        ...input, id, activeKey: input.fingerprint, status: "running", busyAttempts: 0, targetLangBasis: null, clean: null, reasons: null,
        detailEs: null, confirmedBy: null, confirmedAt: null, lines: null, createdAt: now, updatedAt: now,
      };
      rows.set(id, { lote, files: [], documents: [] });
      calls.push(`create:${id}`);
      return { ...lote };
    },
    async claim(id, staleBefore) {
      const e = rows.get(id);
      if (!e || e.lote.activeKey === null) return false;
      const ok = e.lote.status === "busy" || (e.lote.status === "running" && e.lote.updatedAt < staleBefore);
      if (ok) {
        e.lote.status = "running";
        touch(e);
      }
      calls.push(`claim:${id}:${ok}`);
      return ok;
    },
    async markBusy(id, attempts, files, detailEs) {
      const e = rows.get(id)!;
      Object.assign(e.lote, { status: "busy", busyAttempts: attempts, detailEs });
      e.files = files;
      touch(e);
    },
    async finish(id, o) {
      const e = rows.get(id)!;
      Object.assign(e.lote, { status: o.status, activeKey: null, targetLang: o.targetLang ?? e.lote.targetLang, targetLangBasis: o.targetLangBasis, clean: o.clean, reasons: o.reasons, detailEs: o.detailEs });
      e.files = o.files;
      e.documents = o.documents;
      touch(e);
    },
    async get(id) {
      const e = rows.get(id);
      return e ? { lote: { ...e.lote }, files: [...e.files], documents: [...e.documents] } : null;
    },
    async replaceDocuments(id, documents) {
      const e = rows.get(id);
      if (!e || e.lote.status !== "ok") return false;
      e.documents = documents;
      touch(e);
      return true;
    },
    async confirm(id, by, lines, seenUpdatedAt) {
      const e = rows.get(id);
      if (!e || e.lote.status !== "ok" || e.lote.updatedAt.getTime() !== seenUpdatedAt.getTime()) return false;
      Object.assign(e.lote, { status: "confirmed", confirmedBy: by, confirmedAt: clock(), lines });
      return true;
    },
    async linkQuote(id, quoteId) {
      const e = rows.get(id);
      if (!e || e.lote.status !== "confirmed" || e.lote.quoteId) return false;
      e.lote.quoteId = quoteId;
      return true;
    },
    async setTargetLang(id, targetLang) {
      const e = rows.get(id);
      if (!e || e.lote.status !== "ok") return false;
      e.lote.targetLang = targetLang;
      touch(e);
      return true;
    },
  };
  return { store, rows, calls };
}

let ids = 0;
export const newId = () => `doc-${++ids}`;

export function working(id: string, parts: [number, number][], extra: Partial<ReadDocumentRaw> = {}, over: Partial<WorkingDocument> = {}): WorkingDocument {
  const d = doc(id, parts, extra);
  return {
    id: `w-${id}`, position: 0, docKey: id, type: d.type, category: d.category, typeLabelEs: d.typeLabelEs, holder: d.holder, sourceLang: d.sourceLang,
    parts: d.parts, annexes: d.annexes, apostille: d.apostille, pageCount: d.parts.length, words: d.estimatedWords, wordsBasis: "exact",
    estimatedWords: d.estimatedWords, legibility: d.legibility, confidence: d.confidence, isBilingualDuplicate: false, reasons: [],
    included: true, excludedReason: null, manualPriceCents: null, manualCostCents: null, editedBy: null, ...over,
  };
}
