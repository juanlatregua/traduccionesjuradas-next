import { documentLabel } from "../lectura/label.ts";
import type { ReviewReason } from "../lectura/assess.ts";
import type { DocumentType, Part, ReadDocumentRaw } from "../lectura/schema.ts";

type Apostille = ReadDocumentRaw["apostille"];
export type DocReason = ReviewReason | { code: "person_edit"; detail: string; documentId?: string };

export type WorkingDocument = {
  id: string;
  position: number;
  docKey: string;
  type: DocumentType | string;
  category: string;
  typeLabelEs: string;
  holder: string | null;
  sourceLang: string;
  parts: Part[];
  annexes: { labelEs: string; parts: Part[] }[];
  apostille: Apostille;
  pageCount: number;
  words: number;
  wordsBasis: "exact" | "estimated";
  estimatedWords: number;
  legibility: string;
  confidence: number;
  isBilingualDuplicate: boolean;
  reasons: DocReason[];
  included: boolean;
  excludedReason: string | null;
  manualPriceCents: number | null;
  manualCostCents: number | null;
  editedBy: string | null;
};

export type ReadDocumentLike = ReadDocumentRaw & { pageCount: number; words: number; wordsBasis: "exact" | "estimated" };

export function labelOf(d: Pick<WorkingDocument, "typeLabelEs" | "holder" | "apostille">): string {
  return documentLabel({ typeLabelEs: d.typeLabelEs, holder: d.holder, apostille: d.apostille });
}

const bodyPages = (d: Pick<WorkingDocument, "parts" | "annexes">) => d.parts.length + d.annexes.reduce((n, a) => n + a.parts.length, 0);

export function workingFromReading(documents: readonly ReadDocumentLike[], reasons: readonly ReviewReason[], newId: () => string): WorkingDocument[] {
  return documents.map((d, i) => ({
    id: newId(),
    position: i,
    docKey: d.id,
    type: d.type,
    category: d.category,
    typeLabelEs: d.typeLabelEs,
    holder: d.holder,
    sourceLang: d.sourceLang,
    parts: d.parts,
    annexes: d.annexes ?? [],
    apostille: d.apostille,
    pageCount: d.pageCount,
    words: d.words,
    wordsBasis: d.wordsBasis,
    estimatedWords: d.estimatedWords,
    legibility: d.legibility,
    confidence: d.confidence,
    isBilingualDuplicate: d.isBilingualDuplicate,
    reasons: reasons.filter((r) => r.documentId === d.id),
    included: true,
    excludedReason: null,
    manualPriceCents: null,
    manualCostCents: null,
    editedBy: null,
  }));
}

export type EditOp =
  | { op: "merge"; ids: string[] }
  | { op: "split"; id: string; at: number }
  | { op: "setType"; id: string; type: string; typeLabelEs: string; sourceLang?: string }
  | { op: "exclude"; id: string; reason: string }
  | { op: "include"; id: string }
  | { op: "setPrice"; id: string; priceCents: number | null; costCents: number | null };

export type EditResult = { ok: true; documents: WorkingDocument[] } | { ok: false; error: string };

const personReason = (detail: string, documentId: string): DocReason => ({ code: "person_edit", detail, documentId });

function mergeApostilles(list: Apostille[]): Apostille {
  const present = list.filter((a): a is NonNullable<Apostille> => a !== null);
  if (present.length === 0) return null;
  if (present.length === 1) return present[0];
  const numbers = present.map((a) => a.number).filter((n): n is string => Boolean(n));
  return {
    parts: present.flatMap((a) => a.parts),
    onDocumentPage: present.some((a) => a.onDocumentPage),
    number: numbers.length === present.length ? numbers.join(" / ") : null,
    matchedBy: "weak",
  };
}

const renumber = (docs: WorkingDocument[]) => docs.map((d, i) => ({ ...d, position: i }));

export function applyEdit(documents: readonly WorkingDocument[], edit: EditOp, by: string, newId: () => string): EditResult {
  const find = (id: string) => documents.find((d) => d.id === id);
  if (edit.op === "merge") {
    const ids = [...new Set(edit.ids)];
    if (ids.length < 2) return { ok: false, error: "Para unir hacen falta al menos dos documentos." };
    const picked = documents.filter((d) => ids.includes(d.id));
    if (picked.length !== ids.length) return { ok: false, error: "Algún documento ya no existe: recarga la lectura." };
    const [first] = picked;
    const merged: WorkingDocument = {
      ...first,
      id: newId(),
      docKey: picked.map((d) => d.docKey).join("+"),
      parts: picked.flatMap((d) => d.parts),
      annexes: picked.flatMap((d) => d.annexes),
      apostille: mergeApostilles(picked.map((d) => d.apostille)),
      words: picked.reduce((n, d) => n + d.words, 0),
      wordsBasis: picked.every((d) => d.wordsBasis === "exact") ? "exact" : "estimated",
      estimatedWords: picked.reduce((n, d) => n + d.estimatedWords, 0),
      confidence: Math.min(...picked.map((d) => d.confidence)),
      reasons: [...picked.flatMap((d) => d.reasons), personReason(`unido a mano por ${by} (${picked.length} documentos)`, first.docKey)],
      included: picked.every((d) => d.included),
      excludedReason: picked.every((d) => d.included) ? null : first.excludedReason,
      manualPriceCents: null,
      manualCostCents: null,
      editedBy: by,
    };
    merged.pageCount = bodyPages(merged);
    const out: WorkingDocument[] = [];
    for (const d of documents) {
      if (d.id === first.id) out.push(merged);
      else if (!ids.includes(d.id)) out.push(d);
    }
    return { ok: true, documents: renumber(out) };
  }

  const target = find(edit.id);
  if (!target) return { ok: false, error: "Ese documento ya no existe: recarga la lectura." };
  const replace = (next: WorkingDocument[]) => renumber(documents.flatMap((d) => (d.id === target.id ? next : [d])));

  if (edit.op === "split") {
    if (!Number.isInteger(edit.at) || edit.at < 1 || edit.at >= target.parts.length) {
      return { ok: false, error: `Se separa entre páginas del cuerpo: elige un punto de 1 a ${Math.max(1, target.parts.length - 1)}.` };
    }
    const share = (n: number) => Math.round((target.words * n) / Math.max(1, target.parts.length));
    const head = target.parts.slice(0, edit.at);
    const tail = target.parts.slice(edit.at);
    const note = (key: string) => personReason(`separado a mano por ${by}: palabras repartidas por páginas, estimadas`, key);
    const a: WorkingDocument = {
      ...target, id: newId(), docKey: `${target.docKey}a`, parts: head, annexes: [], words: share(head.length), wordsBasis: "estimated",
      estimatedWords: Math.round((target.estimatedWords * head.length) / target.parts.length),
      reasons: [...target.reasons, note(`${target.docKey}a`)], manualPriceCents: null, manualCostCents: null, editedBy: by,
    };
    const b: WorkingDocument = {
      ...target, id: newId(), docKey: `${target.docKey}b`, parts: tail, apostille: null, words: target.words - a.words, wordsBasis: "estimated",
      estimatedWords: target.estimatedWords - a.estimatedWords,
      reasons: [...target.reasons, note(`${target.docKey}b`)], manualPriceCents: null, manualCostCents: null, editedBy: by,
    };
    a.pageCount = bodyPages(a);
    b.pageCount = bodyPages(b);
    return { ok: true, documents: replace([a, b]) };
  }
  if (edit.op === "setType") {
    return { ok: true, documents: replace([{ ...target, type: edit.type, typeLabelEs: edit.typeLabelEs.trim(), sourceLang: edit.sourceLang ?? target.sourceLang, editedBy: by }]) };
  }
  if (edit.op === "exclude") {
    const reason = edit.reason.trim();
    if (reason.length < 3) return { ok: false, error: "Di por qué no se incluye." };
    return { ok: true, documents: replace([{ ...target, included: false, excludedReason: reason, editedBy: by }]) };
  }
  if (edit.op === "include") {
    return { ok: true, documents: replace([{ ...target, included: true, excludedReason: null, editedBy: by }]) };
  }
  return { ok: true, documents: replace([{ ...target, manualPriceCents: edit.priceCents, manualCostCents: edit.costCents, editedBy: by }]) };
}
