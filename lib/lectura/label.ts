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

/**
 * The one visible name of a document (PDF, quote line, screens):
 * «<tipo> <titular> — apostilla n.º <número>», without holder when none was read,
 * «— apostilla (n.º no legible)» when the number could not be read, nothing when there is no apostille.
 * When too long, the holder (then the type) is shortened: the apostille part is never cut.
 */
export function documentLabel(document: Pick<ReadDocumentRaw, "typeLabelEs" | "holder" | "apostille">, max = MAX_LABEL): string {
  const number = document.apostille ? cleanLabelText(document.apostille.number) : "";
  const tail = !document.apostille ? "" : ` — ${number ? `apostilla n.º ${cut(number, 40)}` : "apostilla (n.º no legible)"}`;
  let type = cleanLabelText(document.typeLabelEs) || "Documento";
  let holder = cleanLabelText(document.holder);
  const room = max - len(tail);
  if (len(type) > room) type = cut(type, Math.max(10, room));
  if (holder && len(type) + 1 + len(holder) > room) {
    const left = room - len(type) - 1;
    holder = left >= 4 ? cut(holder, left) : "";
  }
  return `${holder ? `${type} ${holder}` : type}${tail}`;
}
