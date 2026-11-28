import type { ModelReading, Part } from "./lectura/schema.ts";

/** EXPEDIENTE_AGRUPAR=on groups the staff intake by document after the per-file analyses; anything else keeps it per file. */
export function expedienteAgruparOn(env: Record<string, string | undefined> = process.env): boolean {
  return (env.EXPEDIENTE_AGRUPAR || "").trim().toLowerCase() === "on";
}

export type GroupPart = { analysisId: string; pageStart: number; pageEnd: number };

export type GroupingMapping = {
  documents: { key: string; labelEs: string; type: string; words: number; parts: GroupPart[]; apostille: { parts: GroupPart[]; onDocumentPage: boolean } | null }[];
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

export type GroupFile = { url: string; fileName: string; pageStart: number; pageEnd: number };

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
  groupFiles?: GroupFile[];
};

export type GroupingResult<R> = { rows: R[]; applied: boolean; documents: number; excluded: number; reasonEs?: string };

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

type Group = { kind: "doc"; doc: GroupingMapping["documents"][number]; body: string[]; apostille: string[] } | { kind: "out"; note: string; keys: string[] };

/**
 * Per-file rows of the intake + the lectura of the whole batch → one row per document.
 * Merged rows come back «autoPriced» with no price: the intake prices them with its usual engine.
 * Rows the lectura does not cover stay as they were; if a row would be split between a document and
 * nothing, nothing is grouped (better per file than a page charged twice or lost).
 */
export function applyGrouping<R extends GroupableRow>(rows: readonly R[], mapping: GroupingMapping, newId: () => string): GroupingResult<R> {
  const none = (reasonEs?: string): GroupingResult<R> => ({ rows: [...rows], applied: false, documents: 0, excluded: 0, reasonEs });
  const owner = new Map<string, number>();
  rows.forEach((r, i) => {
    if (!r.sourceAnalysisId || !GROUPABLE.has(r.status)) return;
    for (const p of pagesOf(r)) owner.set(key(r.sourceAnalysisId, p), i);
  });
  const known = (keys: string[]) => keys.filter((k) => owner.has(k));
  const groups: Group[] = [
    ...mapping.documents.map((doc): Group => ({ kind: "doc", doc, body: known(expand(doc.parts)), apostille: known(expand(doc.apostille?.parts ?? [])) })),
    ...mapping.duplicates.map((d): Group => ({ kind: "out", note: `${d.reasonEs}: fuera del presupuesto`, keys: known(expand(d.parts)) })),
    ...mapping.notToTranslate.map((n): Group => ({ kind: "out", note: n.reasonEs, keys: known(expand(n.parts)) })),
  ].filter((g) => (g.kind === "doc" ? g.body.length > 0 : g.keys.length > 0));
  if (groups.length === 0) return none("La lectura no reconoce ninguna de las líneas.");

  const claimed = new Map<string, number>();
  groups.forEach((g, gi) => {
    for (const k of g.kind === "doc" ? [...g.body, ...g.apostille] : g.keys) if (!claimed.has(k)) claimed.set(k, gi);
  });
  const rowsOf = (keys: string[]) => [...new Set(keys.map((k) => owner.get(k)!))].sort((a, b) => a - b);
  const touched = new Set(groups.flatMap((g) => rowsOf(g.kind === "doc" ? [...g.body, ...g.apostille] : g.keys)));
  for (const i of touched) {
    const r = rows[i];
    if (pagesOf(r).some((p) => !claimed.has(key(r.sourceAnalysisId!, p)))) return none(`La lectura no cubre todas las páginas de «${baseName(r.fileName)}».`);
  }

  const whole = (i: number, keys: Set<string>) => pagesOf(rows[i]).every((p) => keys.has(key(rows[i].sourceAnalysisId!, p)));
  const segments = (keys: string[]) => {
    const byRow = new Map<number, number[]>();
    for (const k of keys) {
      const i = owner.get(k)!;
      byRow.set(i, [...(byRow.get(i) ?? []), Number(k.slice(k.lastIndexOf("#") + 1))]);
    }
    return [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([i, pages]) => ({ i, start: Math.min(...pages), end: Math.max(...pages), count: pages.length }));
  };

  let documents = 0;
  let excluded = 0;
  const emit = new Map<number, R[]>();
  const push = (at: number, r: R) => emit.set(at, [...(emit.get(at) ?? []), r]);

  for (const g of groups) {
    if (g.kind === "out") {
      const set = new Set(g.keys);
      for (const s of segments(g.keys)) {
        const r = rows[s.i];
        const out = whole(s.i, set) ? { ...r } : { ...r, localId: newId(), pageStart: s.start, pageEnd: s.end, pages: s.count, words: undefined, fileName: `${baseName(r.fileName)} · ${s.end > s.start ? `págs ${s.start}-${s.end}` : `pág ${s.start}`}` };
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
    const bodySegs = segments(g.body);
    const host = rows[bodyRows.reduce((best, i) => ((rows[i].words || 0) > (rows[best].words || 0) && rows[i].documentType !== "apostille" ? i : best), first)];
    const own = bodySegs[0];
    const fullRows = allRows.every((i) => whole(i, set));
    const rowWords = allRows.reduce((s, i) => s + (rows[i].words || 0), 0);
    const words = fullRows && rowWords > 0 ? rowWords : g.doc.words || rowWords || undefined;
    const files: GroupFile[] = segments(all)
      .map((s) => ({ url: rows[s.i].blobUrl || "", fileName: baseName(rows[s.i].fileName), pageStart: s.start, pageEnd: s.end }))
      .filter((f) => f.url);
    const names = [...new Set(files.map((f) => f.fileName))];
    const apostilleOwnPages = g.apostille.length > 0;
    const merged = {
      ...host,
      localId: newId(),
      status: "split",
      include: true,
      fileName: names.join(" + ") || baseName(host.fileName),
      sourceAnalysisId: rows[own.i].sourceAnalysisId,
      blobUrl: rows[own.i].blobUrl,
      pageStart: own.start,
      pageEnd: own.end,
      pages: all.length,
      words,
      hasApostille: !!g.doc.apostille || !!host.hasApostille,
      apostilleSeparatePage: apostilleOwnPages ? true : host.apostilleSeparatePage,
      unitPrice: 0,
      clientPrice: undefined,
      autoPriced: true,
      basis: undefined,
      priorFrom: undefined,
      priceNote: undefined,
      minApplied: false,
      absorbedPages: undefined,
      analysisId: undefined,
      groupNote: `Agrupado: ${allRows.length} línea${allRows.length === 1 ? "" : "s"} → 1 documento${apostilleOwnPages ? " con su apostilla" : ""}`,
      groupFiles: files.length > 1 ? files : undefined,
    } as R;
    push(first, merged);
  }

  const out: R[] = [];
  rows.forEach((r, i) => {
    if (emit.has(i)) out.push(...emit.get(i)!);
    else if (!touched.has(i)) out.push(r);
  });
  return { rows: out, applied: true, documents, excluded };
}
