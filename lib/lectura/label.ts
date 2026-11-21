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

const HOLE = "\u0001";
/** Words that only introduce a value («curso 2021-2022», «semestres 1 y 2»): with the value gone, they go too. */
const SLOT_WORDS = "cursos?|años?|semestres?|cuatrimestres?|trimestres?|periodos?|períodos?|niveles?|nivel|sesi[oó]n|sesiones|promoci[oó]n|convocatorias?|ejercicios?|tomos?|folios?|hojas?|p[aá]ginas?|p[aá]gs?\\.?|ediciones|edici[oó]n|n[uú]meros?|ann[ée]es?|ann[ée]e|sessions?|years?|terms?|levels?|semesters?";
const CONNECTOR = "(?:y|e|o|u|a|al|et|and|und|ou|to|-|–|—|/|,)";
const HOLE_LIST = new RegExp(`${HOLE}(?:\\s*${CONNECTOR}\\s*${HOLE})+`, "giu");
const EMPTY_SLOT = new RegExp(`(?<![\\p{L}\\p{N}])(?:${SLOT_WORDS})(?![\\p{L}\\p{N}])\\s*(?:${HOLE}\\s*)?(?:(?:y|e|et|and|und)\\s*)?(?=[,;:)\\]]|$)`, "giu");
const EMPTY_SLOT_HOLE = new RegExp(`(?<![\\p{L}\\p{N}])(?:${SLOT_WORDS})(?![\\p{L}\\p{N}])\\s*${HOLE}`, "giu");

/** «curso 2021-2022», «semestres 1 y 2»: the value says WHICH document it is (one bulletin per semester), so it stays. */
const KEPT_SLOT_WORDS = "cursos?|años?|semestres?|cuatrimestres?|trimestres?|periodos?|períodos?|niveles?|nivel|sesi[oó]n|sesiones|promoci[oó]n|convocatorias?|ann[ée]es?|ann[ée]e|sessions?|years?|terms?|levels?|semesters?";
const VALUE = "\\p{N}+(?:[./-]\\p{N}+)*";
const KEPT_SLOT = new RegExp(`(?<![\\p{L}\\p{N}])(?:${KEPT_SLOT_WORDS})(?![\\p{L}\\p{N}])\\s+${VALUE}(?:\\s*(?:,|y|e|et|and|und|a|al|to|-|–)\\s*${VALUE})*(?![\\p{L}\\p{N}])`, "giu");

/** Removes what a stripped value leaves behind: «(…, curso , semestres y )» → «(…)». */
function closeHoles(t: string): string {
  let out = t.replace(HOLE_LIST, HOLE).replace(EMPTY_SLOT_HOLE, " ").replace(EMPTY_SLOT, " ").replace(new RegExp(HOLE, "g"), " ");
  for (let prev = ""; prev !== out; ) {
    prev = out;
    out = out
      .replace(/\s+([,;:)\]])/g, "$1")
      .replace(/([(\[])\s+/g, "$1")
      .replace(/([,;:])(?:\s*[,;:])+/g, "$1")
      .replace(/([(\[])[,;:]\s*/g, "$1")
      .replace(/[,;:]\s*([)\]])/g, "$1")
      .replace(/\s*[(\[]\s*[)\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return out;
}

/** The type alone: the apostille has its own part of the label and numbers belong to no type. */
export function cleanTypeLabel(s: string | null | undefined): string {
  const kept: string[] = [];
  const masked = cleanLabelText(s).replace(KEPT_SLOT, (m) => String.fromCharCode(0xe000 + kept.push(m) - 1));
  let t = closeHoles(masked.replace(APOSTILLE_IN_TYPE, " ").replace(NUMBER_IN_TYPE, ` ${HOLE} `)).replace(/[\ue000-\ue0ff]/g, (c) => kept[c.charCodeAt(0) - 0xe000] ?? "");
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
