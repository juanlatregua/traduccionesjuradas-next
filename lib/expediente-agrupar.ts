import type { ModelReading, Part } from "./lectura/schema.ts";

/** EXPEDIENTE_AGRUPAR=on groups the staff intake by document after the per-file analyses; anything else keeps it per file. */
export function expedienteAgruparOn(env: Record<string, string | undefined> = process.env): boolean {
  return (env.EXPEDIENTE_AGRUPAR || "").trim().toLowerCase() === "on";
}

export type GroupPart = { analysisId: string; pageStart: number; pageEnd: number };

export type MergedFile = { analysisId: string; url: string; fileName: string; pageCount: number };

export type GroupedDocument = {
  key: string;
  labelEs: string;
  type: string;
  words: number;
  parts: GroupPart[];
  apostille: { parts: GroupPart[]; onDocumentPage: boolean } | null;
  /** The document's pages joined into one PDF (only when they come from several files or are not contiguous). */
  merged?: MergedFile;
  mergeError?: string;
};

export type GroupingMapping = {
  documents: GroupedDocument[];
  duplicates: { parts: GroupPart[]; ofDocument: string | null; reasonEs: string }[];
  notToTranslate: { parts: GroupPart[]; reasonEs: string }[];
  questions: { textEs: string; aboutDocument: string | null }[];
};

export type LoteFile = { position: number | null; url: string | null; sha256: string | null; pageCount: number | null; state: string; name: string };
export type GroupAnalysis = { id: string; fileUrl: string; fileName: string; pageCount: number };

function toRanges(pages: { analysisId: string; page: number }[]): GroupPart[] {
  const byFile = new Map<string, number[]>();
  for (const p of pages) byFile.set(p.analysisId, [...(byFile.get(p.analysisId) ?? []), p.page]);
  const out: GroupPart[] = [];
  for (const [analysisId, list] of byFile) {
    for (const page of [...new Set(list)].sort((a, b) => a - b)) {
      const last = out[out.length - 1];
      if (last && last.analysisId === analysisId && page === last.pageEnd + 1) last.pageEnd = page;
      else out.push({ analysisId, pageStart: page, pageEnd: page });
    }
  }
  return out;
}

/** Lectura of the batch (pages as «file N, page p») → pages of each DocumentAnalysis of the intake. */
export function buildGroupingMapping(
  reading: ModelReading,
  files: readonly LoteFile[],
  analyses: readonly GroupAnalysis[],
  docInfo: ReadonlyMap<string, { labelEs: string; words: number }>
): GroupingMapping {
  const idByUrl = new Map(analyses.map((a) => [a.fileUrl, a.id]));
  const at = new Map<number, { analysisId: string; offset: number }>();
  const offsets = new Map<string, number>();
  for (const f of [...files].filter((x) => x.state === "ok" && x.position != null).sort((a, b) => a.position! - b.position!)) {
    const id = f.url ? idByUrl.get(f.url) : undefined;
    if (!id) continue;
    const offset = offsets.get(id) ?? 0;
    at.set(f.position!, { analysisId: id, offset });
    offsets.set(id, offset + (f.pageCount || 1));
  }
  const map = (parts: readonly Part[]) =>
    toRanges(parts.flatMap((p) => {
      const f = at.get(p.fileIndex);
      return f ? [{ analysisId: f.analysisId, page: f.offset + p.page }] : [];
    }));
  const docOfPart = (p: Part) => reading.documents.find((d) => [...d.parts, ...d.annexes.flatMap((a) => a.parts)].some((q) => q.fileIndex === p.fileIndex && q.page === p.page))?.id ?? null;
  const labelOf = (key: string | null) => (key ? docInfo.get(key)?.labelEs ?? key : null);

  const duplicates: GroupingMapping["duplicates"] = reading.duplicates.map((d) => {
    const ofDocument = d.duplicateOf.documentId ?? (d.duplicateOf.parts[0] ? docOfPart(d.duplicateOf.parts[0]) : null);
    return { parts: map(d.parts), ofDocument, reasonEs: ofDocument ? `Duplicado de «${labelOf(ofDocument)}»` : "Página repetida" };
  });
  for (const f of files) {
    if (f.state !== "duplicate" || !f.url || !f.sha256) continue;
    const id = idByUrl.get(f.url);
    const original = files.find((o) => o.state === "ok" && o.sha256 === f.sha256 && o.position != null);
    if (!id || !original) continue;
    const ofDocument = docOfPart({ fileIndex: original.position!, page: 1 });
    const pages = Math.max(1, analyses.find((a) => a.id === id)?.pageCount || 1);
    duplicates.push({ parts: [{ analysisId: id, pageStart: 1, pageEnd: pages }], ofDocument, reasonEs: `Copia exacta de «${original.name}»` });
  }

  return {
    documents: reading.documents.map((d) => ({
      key: d.id,
      labelEs: docInfo.get(d.id)?.labelEs ?? d.typeLabelEs,
      type: d.type,
      words: docInfo.get(d.id)?.words ?? Math.max(0, Math.round(d.estimatedWords) || 0),
      parts: map([...d.parts, ...d.annexes.flatMap((a) => a.parts)]),
      apostille: d.apostille ? { parts: map(d.apostille.parts), onDocumentPage: d.apostille.onDocumentPage } : null,
    })),
    duplicates,
    notToTranslate: [
      ...reading.notToTranslate.map((n) => ({ parts: map(n.parts), reasonEs: `No se traduce: ${n.reason}` })),
      ...(reading.instructions && reading.instructions.parts.length ? [{ parts: map(reading.instructions.parts), reasonEs: "Requerimiento o instrucciones del organismo: no se traduce" }] : []),
    ],
    questions: reading.questions.map((q) => ({ textEs: q.textEs, aboutDocument: labelOf(q.aboutDocumentId) })),
  };
}

/** Pages of the document in physical order: body (and annexes), then the apostille sheets. */
export const documentParts = (d: Pick<GroupedDocument, "parts" | "apostille">): GroupPart[] => [...d.parts, ...(d.apostille?.parts ?? [])];

/** One line points at one file and one page range: anything else needs its pages joined into a new PDF. */
export function needsMerge(d: Pick<GroupedDocument, "parts" | "apostille">): boolean {
  const parts = documentParts(d);
  if (new Set(parts.map((p) => p.analysisId)).size > 1) return true;
  const sorted = [...parts].sort((a, b) => a.pageStart - b.pageStart);
  return sorted.some((p, i) => i > 0 && p.pageStart !== sorted[i - 1].pageEnd + 1);
}

export type GroupableRow = {
  localId: string;
  fileName: string;
  status: string;
  include: boolean;
  sourceAnalysisId?: string;
  blobUrl?: string;
  pageStart?: number;
  pageEnd?: number;
  pages?: number;
  words?: number;
  documentType?: string;
  hasApostille?: boolean;
  apostilleSeparatePage?: boolean;
  unitPrice: number;
  clientPrice?: number;
  autoPriced?: boolean;
  priceNote?: string;
  minApplied?: boolean;
  basis?: "word" | "unit";
  priorFrom?: string;
  absorbedPages?: number[];
  analysisId?: string;
  groupNote?: string;
};

export type GroupingResult<R> = { rows: R[]; applied: boolean; documents: number; excluded: number; warnings: string[]; reasonEs?: string };

export const MERGED_PRICE_NOTE = "Documento agrupado: revisa el precio";

const GROUPABLE = new Set(["done", "split"]);
const key = (analysisId: string, page: number) => `${analysisId}#${page}`;
const pagesOf = (r: GroupableRow): number[] => {
  const start = r.pageStart ?? 1;
  const end = r.pageEnd ?? (r.pageStart != null ? r.pageStart : Math.max(1, r.pages || 1));
  return Array.from({ length: Math.max(1, end - start + 1) }, (_, i) => start + i);
};
const expand = (parts: readonly GroupPart[]) =>
  parts.flatMap((p) => Array.from({ length: Math.max(1, p.pageEnd - p.pageStart + 1) }, (_, i) => key(p.analysisId, p.pageStart + i)));
const baseName = (s: string) => s.replace(/ · págs? .*$/, "");

/** A row with a price someone set (by hand, a previous quote, the jurado's figure, a per-word/per-document rate) is never regrouped. */
export const lockedRow = (r: GroupableRow) => r.autoPriced === false || !!r.priorFrom || !!r.basis;

type Group = { kind: "doc"; doc: GroupedDocument; body: string[]; apostille: string[] } | { kind: "out"; note: string; keys: string[] };

/**
 * Per-file rows of the intake + the lectura of the whole batch → one row per document.
 * Merged rows come back «autoPriced» with no price and a note: the intake prices them with its usual engine.
 * Rows the lectura does not cover stay as they were. A document stays per file (with a warning) when its pages
 * could not be joined into one PDF, when one of its rows already carries a set price, or when one of its pages is
 * not in a groupable row; if that leaves a row half grouped, nothing is grouped (no page charged twice or lost).
 */
export function applyGrouping<R extends GroupableRow>(rows: readonly R[], mapping: GroupingMapping, newId: () => string): GroupingResult<R> {
  const warnings: string[] = [];
  const none = (reasonEs?: string): GroupingResult<R> => ({ rows: [...rows], applied: false, documents: 0, excluded: 0, warnings, reasonEs });
  const owner = new Map<string, number>();
  rows.forEach((r, i) => {
    if (!r.sourceAnalysisId || !GROUPABLE.has(r.status)) return;
    for (const p of pagesOf(r)) owner.set(key(r.sourceAnalysisId, p), i);
  });
  const known = (keys: string[]) => keys.filter((k) => owner.has(k));
  const rowsOf = (keys: string[]) => [...new Set(known(keys).map((k) => owner.get(k)!))].sort((a, b) => a - b);

  const groups: Group[] = [];
  const skippedRows = new Set<number>();
  const skip = (keys: string[], why: string) => {
    for (const i of rowsOf(keys)) skippedRows.add(i);
    warnings.push(why);
  };
  for (const doc of mapping.documents) {
    const all = expand(documentParts(doc));
    const body = known(expand(doc.parts));
    if (body.length === 0) continue;
    const apostille = known(expand(doc.apostille?.parts ?? []));
    const docRows = rowsOf(all);
    const untouched = docRows.length === 1 && known(all).length === all.length && pagesOf(rows[docRows[0]]).length === all.length;
    if (untouched) groups.push({ kind: "doc", doc, body, apostille });
    else if (known(all).length !== all.length) skip(all, `«${doc.labelEs}»: tiene páginas en líneas que no se pueden agrupar; se queda por archivo.`);
    else if (docRows.some((i) => lockedRow(rows[i]))) skip(all, `«${doc.labelEs}»: una de sus líneas ya tiene precio puesto; se queda por archivo.`);
    else if (needsMerge(doc) && !doc.merged) skip(all, `«${doc.labelEs}»: no se pudieron unir sus archivos en un PDF${doc.mergeError ? ` (${doc.mergeError})` : ""}; se queda por archivo.`);
    else groups.push({ kind: "doc", doc, body, apostille });
  }
  const outs = [
    ...mapping.duplicates.map((d) => ({ note: `${d.reasonEs}: fuera del presupuesto`, parts: d.parts })),
    ...mapping.notToTranslate.map((n) => ({ note: n.reasonEs, parts: n.parts })),
  ];
  for (const o of outs) {
    const keys = known(expand(o.parts));
    if (keys.length === 0) continue;
    if (rowsOf(keys).some((i) => lockedRow(rows[i]))) skip(keys, `${o.note}: la línea ya tiene precio puesto; se queda.`);
    else groups.push({ kind: "out", note: o.note, keys });
  }
  const claimed = new Set(groups.flatMap((g) => (g.kind === "doc" ? [...g.body, ...g.apostille] : g.keys)));
  const touched = new Set(groups.flatMap((g) => rowsOf(g.kind === "doc" ? [...g.body, ...g.apostille] : g.keys)));
  for (const i of touched) {
    const r = rows[i];
    if (skippedRows.has(i) || pagesOf(r).some((p) => !claimed.has(key(r.sourceAnalysisId!, p)))) return none(`La lectura no cubre todas las páginas de «${baseName(r.fileName)}»: se queda la lista por archivo.`);
  }

  const whole = (i: number, keys: Set<string>) => pagesOf(rows[i]).every((p) => keys.has(key(rows[i].sourceAnalysisId!, p)));
  const unchanged = (g: Group) => {
    if (g.kind === "out") return false;
    const all = [...g.body, ...g.apostille];
    const r = rowsOf(all);
    return r.length === 1 && g.apostille.length === 0 && whole(r[0], new Set(all));
  };
  if (groups.every(unchanged)) return none(warnings[0] ?? "La lectura no cambia nada: cada archivo ya es un documento.");
  const segments = (keys: string[]) => {
    const byRow = new Map<number, number[]>();
    for (const k of keys) {
      const i = owner.get(k)!;
      byRow.set(i, [...(byRow.get(i) ?? []), Number(k.slice(k.lastIndexOf("#") + 1))]);
    }
    return [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([i, pages]) => ({ i, start: Math.min(...pages), end: Math.max(...pages), count: pages.length }));
  };
  const range = (start: number, end: number) => (end > start ? `págs ${start}-${end}` : `pág ${start}`);

  let documents = 0;
  let excluded = 0;
  const emit = new Map<number, R[]>();
  const push = (at: number, r: R) => emit.set(at, [...(emit.get(at) ?? []), r]);

  for (const g of groups) {
    if (g.kind === "out") {
      const set = new Set(g.keys);
      for (const s of segments(g.keys)) {
        const r = rows[s.i];
        const out = whole(s.i, set) ? { ...r } : { ...r, localId: newId(), pageStart: s.start, pageEnd: s.end, pages: s.count, words: undefined, fileName: `${baseName(r.fileName)} · ${range(s.start, s.end)}` };
        push(s.i, { ...out, include: false, autoPriced: false, unitPrice: 0, clientPrice: undefined, priceNote: undefined, groupNote: g.note } as R);
        excluded += 1;
      }
      continue;
    }
    documents += 1;
    const all = [...g.body, ...g.apostille];
    const set = new Set(all);
    const bodyRows = rowsOf(g.body);
    const allRows = rowsOf(all);
    const first = bodyRows[0];
    if (allRows.length === 1 && whole(first, set) && g.apostille.length === 0) {
      push(first, rows[first]);
      continue;
    }
    const notApostille = bodyRows.filter((i) => rows[i].documentType !== "apostille");
    const candidates = notApostille.length ? notApostille : bodyRows;
    const host = rows[candidates.reduce((best, i) => ((rows[i].words || 0) > (rows[best].words || 0) ? i : best), candidates[0])];
    const fullRows = allRows.every((i) => whole(i, set));
    const rowWords = allRows.reduce((s, i) => s + (rows[i].words || 0), 0);
    const words = fullRows && rowWords > 0 ? rowWords : g.doc.words || rowWords || undefined;
    const segs = segments(all);
    const start = Math.min(...segs.map((s) => s.start));
    const end = Math.max(...segs.map((s) => s.end));
    const file = g.doc.merged
      ? { sourceAnalysisId: g.doc.merged.analysisId, blobUrl: g.doc.merged.url, pageStart: 1, pageEnd: g.doc.merged.pageCount, fileName: g.doc.merged.fileName }
      : { sourceAnalysisId: rows[first].sourceAnalysisId, blobUrl: rows[first].blobUrl, pageStart: start, pageEnd: end, fileName: `${baseName(host.fileName)} · ${range(start, end)}` };
    const apostilleOwnPages = g.apostille.length > 0;
    push(first, {
      ...host,
      ...file,
      localId: newId(),
      status: "split",
      include: true,
      pages: all.length,
      words,
      hasApostille: !!g.doc.apostille || !!host.hasApostille,
      apostilleSeparatePage: apostilleOwnPages ? true : host.apostilleSeparatePage,
      unitPrice: 0,
      clientPrice: undefined,
      autoPriced: true,
      basis: undefined,
      priorFrom: undefined,
      priceNote: MERGED_PRICE_NOTE,
      minApplied: false,
      absorbedPages: undefined,
      analysisId: undefined,
      groupNote: `Agrupado: ${allRows.length} línea${allRows.length === 1 ? "" : "s"} → 1 documento${apostilleOwnPages ? " con su apostilla" : ""}`,
    } as R);
  }

  const out: R[] = [];
  rows.forEach((r, i) => {
    if (emit.has(i)) out.push(...emit.get(i)!);
    else if (!touched.has(i)) out.push(r);
  });
  return { rows: out, applied: true, documents, excluded, warnings };
}

/**
 * «Deshacer agrupación»: back to the per-file rows, keeping the rows added after grouping.
 * `lost` counts the grouped rows edited or removed since (those changes go away with the undo).
 */
export function undoGrouping<R extends { localId: string }>(before: readonly R[], after: readonly R[], current: readonly R[], signature: (r: R) => string) {
  const afterById = new Map(after.map((r) => [r.localId, r]));
  const currentIds = new Set(current.map((r) => r.localId));
  const added = current.filter((r) => !afterById.has(r.localId));
  const edited = current.filter((r) => afterById.has(r.localId) && signature(afterById.get(r.localId)!) !== signature(r)).length;
  const removed = after.filter((r) => !currentIds.has(r.localId)).length;
  return { rows: [...before, ...added], lost: edited + removed, added: added.length };
}
