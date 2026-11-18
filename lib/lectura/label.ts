import type { ReadDocumentRaw } from "./schema.ts";

const CONTROL = /[\p{Cc}\p{Cf}\u2028\u2029]+/gu;
const clean = (s: string | null | undefined) => String(s ?? "").replace(CONTROL, " ").replace(/\s+/g, " ").trim();

/**
 * The one visible name of a document (PDF, quote line, screens):
 * «<tipo> <titular> — apostilla n.º <número>», without holder when none was read,
 * «— apostilla (n.º no legible)» when the number could not be read, nothing when there is no apostille.
 */
export function documentLabel(document: Pick<ReadDocumentRaw, "typeLabelEs" | "holder" | "apostille">): string {
  const type = clean(document.typeLabelEs) || "Documento";
  const holder = clean(document.holder);
  const head = holder ? `${type} ${holder}` : type;
  if (!document.apostille) return head;
  const number = clean(document.apostille.number);
  return `${head} — ${number ? `apostilla n.º ${number}` : "apostilla (n.º no legible)"}`;
}
