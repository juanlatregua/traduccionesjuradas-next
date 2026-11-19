import type { ReadDocumentRaw } from "./schema.ts";

const CONTROL = /[\p{Cc}\p{Cf}\u2028\u2029\ufffd]+/gu;
/** One line, well-formed UTF-16 (lone surrogates removed), no control or format characters. */
export function cleanLabelText(s: string | null | undefined): string {
  return String(s ?? "").toWellFormed().replace(CONTROL, " ").replace(/\s+/g, " ").trim();
}
const cut = (s: string, max: number) => {
  const cps = Array.from(s);
  return cps.length <= max ? s : `${cps.slice(0, Math.max(0, max - 1)).join("").trimEnd()}…`;
};
const len = (s: string) => Array.from(s).length;

export const MAX_LABEL = 120;

const APOSTILLE_IN_TYPE = /(?:\s*[-—–+,;(\[]\s*|\s+)?(?:(?:con|y|e|más|incluida|incluye)\s+)?(?:(?:la|su|una)\s+)?apostill\p{L}*(?:\s+de\s+la\s+haya)?(?:\s*[)\]])?/giu;
const NUMBER_IN_TYPE = /(?:\b(?:n\.?\s*[º°o]|núm|num|no)\.?\s*)?\p{N}[\p{N}.\/-]*/giu;
const DANGLING_END = /(?:\s+(?:con|y|e|de|del|más|n\.?\s*[º°])|\s*[-—–+,;:\/(\[.])+\s*$/iu;
const DANGLING_START = /^\s*[-—–+,;:\/)\].]+\s*/u;

/** The type alone: the apostille has its own part of the label and numbers belong to no type. */
export function cleanTypeLabel(s: string | null | undefined): string {
  let t = cleanLabelText(s).replace(APOSTILLE_IN_TYPE, " ").replace(NUMBER_IN_TYPE, " ").replace(/[(\[]\s*[)\]]/g, " ").replace(/\s+/g, " ").trim();
  for (let prev = ""; prev !== t; ) {
    prev = t;
    t = t.replace(DANGLING_END, "").replace(DANGLING_START, "").trim();
  }
  return t;
}

/**
 * The one visible name of a document (PDF, quote line, screens):
 * «<tipo> <titular> — apostilla n.º <número>», without holder when none was read. The number only shows when the
 * apostille has its own sheet: «— apostilla (n.º no legible)» when it could not be read there, «— apostilla» when it
 * is stamped on a document page, nothing when there is no apostille.
 * When too long, the holder (then the type) is shortened: the apostille part is never cut.
 */
export function documentLabel(document: Pick<ReadDocumentRaw, "typeLabelEs" | "holder" | "apostille">, max = MAX_LABEL): string {
  const ownSheet = (document.apostille?.parts.length ?? 0) > 0;
  const number = ownSheet ? cleanLabelText(document.apostille!.number) : "";
  const tail = !document.apostille ? "" : !ownSheet ? " — apostilla" : ` — ${number ? `apostilla n.º ${cut(number, 40)}` : "apostilla (n.º no legible)"}`;
  let type = cleanTypeLabel(document.typeLabelEs) || "Documento";
  let holder = cleanLabelText(document.holder);
  const room = max - len(tail);
  if (len(type) > room) type = cut(type, Math.max(10, room));
  if (holder && len(type) + 1 + len(holder) > room) {
    const left = room - len(type) - 1;
    holder = left >= 4 ? cut(holder, left) : "";
  }
  return `${holder ? `${type} ${holder}` : type}${tail}`;
}
