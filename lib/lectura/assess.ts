import { FR_DOC_LONG_WORDS, FR_DOC_MAX_PAGES, FR_WORD_CENTS, FR_WORD_MIN_CENTS, FR_WORD_MIN_MULTIPAGE_CENTS, priceFrToEs } from "../dinero/tariff-fr.ts";
import type { PreparedBatch } from "./prepare.ts";
import type { DocumentType, ModelReading, ReadDocumentRaw } from "./schema.ts";

// Deterministic guard. What the model declares cannot be checked in code, so «clean» only rests on structure:
// every received page is a body page (one apostille sheet per document at most), nothing set aside, nothing merged
// across files, no file shared between documents, pages in file order, no repeated types, words counted (not
// estimated) and in line with the model's estimate whenever the price depends on them, and a price floor per page.
// Juan's rule: a document priced by the word or longer than 2 pages is never clean. Only French → Spanish with a
// French tariff can be clean: any other pair, or no applicable tariff, always has a reason. Anything else goes to a person.
// Only a clean reading may ever price without one.

export type ReviewCode =
  | "not_to_translate" | "model_duplicates" | "instructions_pages" | "nothing_to_translate" | "apostille_sheets" | "loose_apostille"
  | "missing_pages" | "declared_pages_mismatch" | "pages_unverified" | "legibility" | "low_confidence" | "type_other"
  | "words_near_threshold" | "words_estimated_price" | "price_below_floor" | "same_type_repeated" | "multi_file_document"
  | "skipped_files" | "target_basis" | "questions" | "annexes" | "apostille_number_unread" | "apostille_pairing_weak" | "not_assessed"
  | "long_document" | "per_word_price" | "words_mismatch" | "bilingual_duplicate" | "file_split" | "pages_out_of_order"
  | "no_tariff" | "pair_without_tariff";
export type ReviewReason = { code: ReviewCode; detail: string; documentId?: string };
export type Assessment = { clean: boolean; reasons: ReviewReason[] };

export const MIN_CONFIDENCE = 0.85;
/** Juan's rule: more pages than this (body + annexes) always goes to a person. */
export const CLEAN_MAX_PAGES = 2;
/** A counted word total is only trusted when it is within this fraction of the model's estimate. */
export const WORDS_AGREEMENT = 0.25;
export const THRESHOLD_MARGIN = 0.15;
/** Word counts where the French tariff changes band. */
export const WORD_THRESHOLDS = [FR_DOC_LONG_WORDS, Math.ceil(FR_WORD_MIN_CENTS / FR_WORD_CENTS), Math.ceil(FR_WORD_MIN_MULTIPAGE_CENTS / FR_WORD_CENTS)];
/**
 * Price floor per received page, from the French tariff in force: a short document (≤ 2 pages) is never below
 * 30 € + 5 € per extra page, a long one never below 30 € per page. Below it the reading has lost pages or value.
 */
export const FLOOR_FIRST_PAGE_CENTS = 3000;
export const FLOOR_EXTRA_PAGE_SHORT_CENTS = 500;
export const FLOOR_PAGE_LONG_CENTS = 3000;
export function pageFloorCents(pages: number): number {
  if (pages <= 0) return 0;
  return pages <= FR_DOC_MAX_PAGES ? FLOOR_FIRST_PAGE_CENTS + FLOOR_EXTRA_PAGE_SHORT_CENTS * (pages - 1) : FLOOR_PAGE_LONG_CENTS * pages;
}
/** Types that normally number their pages: without a declared total, nothing proves the document is complete. */
export const NUMBERED_TYPES: ReadonlySet<DocumentType> = new Set<DocumentType>([
  "contract", "power_of_attorney", "divorce_decree", "company_registration", "bank_statement", "tax_return", "grades", "transcript", "medical_report", "other",
]);

type DocWords = ReadDocumentRaw & { words?: number; wordsBasis?: "exact" | "estimated" };

export function assessReading(
  batch: Pick<PreparedBatch, "skipped">,
  reading: ModelReading & { documents: DocWords[] },
): Assessment {
  const reasons: ReviewReason[] = [];
  const add = (code: ReviewCode, detail: string, documentId?: string) => reasons.push(documentId ? { code, detail, documentId } : { code, detail });
  const count = (list: { parts: unknown[] }[]) => list.reduce((s, x) => s + x.parts.length, 0);

  if (reading.documents.length === 0) add("nothing_to_translate", "la lectura no encuentra nada que traducir");
  if (count(reading.notToTranslate) > 0) add("not_to_translate", `${count(reading.notToTranslate)} página(s) marcadas como «no se traduce»`);
  if (count(reading.duplicates) > 0) add("model_duplicates", `${count(reading.duplicates)} página(s) descartadas como repetidas por el modelo`);
  if (reading.instructions) add("instructions_pages", `${reading.instructions.parts.length} página(s) apartadas como requerimiento`);
  if (batch.skipped.length > 0) add("skipped_files", `${batch.skipped.length} archivo(s) no se pudieron abrir`);
  if (reading.targetLangBasis !== "stated_by_client" && reading.targetLangBasis !== "inferred_from_documents") add("target_basis", `idioma de destino: ${reading.targetLangBasis}`);
  if (reading.questions.length > 0) add("questions", `${reading.questions.length} pregunta(s) pendientes`);

  const byType = new Map<string, number>();
  for (const d of reading.documents) byType.set(d.type, (byType.get(d.type) ?? 0) + 1);
  for (const [type, n] of byType) if (n > 1) add("same_type_repeated", `${n} documentos de tipo ${type}`);

  const owners = new Map<number, Set<string>>();
  for (const d of reading.documents) {
    for (const p of [...d.parts, ...(d.annexes ?? []).flatMap((a) => a.parts), ...(d.apostille?.parts ?? [])]) {
      owners.set(p.fileIndex, (owners.get(p.fileIndex) ?? new Set()).add(d.id));
    }
  }
  for (const [file, ids] of owners) {
    if (ids.size > 1) for (const id of ids) add("file_split", `las páginas del archivo ${file} están repartidas entre ${ids.size} documentos`, id);
  }

  const target = (reading.targetLang || "").trim().toLowerCase();
  for (const d of reading.documents) {
    const body = d.parts.length;
    const sheets = d.apostille?.parts.length ?? 0;
    if (sheets >= 2) add("apostille_sheets", `${sheets} hojas de apostilla (solo se acepta una sin revisar)`, d.id);
    if ((d.annexes ?? []).length > 0) add("annexes", `${d.annexes.length} anexo(s) dentro del documento`, d.id);
    if (d.type === "apostille") add("loose_apostille", "apostilla sin documento", d.id);
    if (d.apostille && !d.apostille.number) add("apostille_number_unread", "número de apostilla no legible", d.id);
    if (d.apostille && d.apostille.matchedBy === "weak") add("apostille_pairing_weak", "apostilla emparejada sin evidencia en el papel", d.id);
    if (d.missingPages.length > 0) add("missing_pages", `faltan ${d.missingPages.length} página(s)`, d.id);
    if (d.declaredPages !== null && d.declaredPages !== body) add("declared_pages_mismatch", `declara ${d.declaredPages}, el cuerpo tiene ${body}`, d.id);
    if (d.declaredPages === null && NUMBERED_TYPES.has(d.type)) add("pages_unverified", "tipo que suele numerar sus páginas y no consta el total", d.id);
    if (d.legibility !== "good") add("legibility", `legibilidad ${d.legibility}`, d.id);
    if (!(d.confidence >= MIN_CONFIDENCE && d.confidence <= 1)) add("low_confidence", `confianza ${d.confidence}`, d.id);
    if (d.type === "other") add("type_other", "tipo no reconocido", d.id);
    // The apostille sheet often comes as its own photo: only body and annex pages count here.
    const files = new Set([...d.parts, ...(d.annexes ?? []).flatMap((a) => a.parts)].map((p) => p.fileIndex));
    if (files.size > 1) add("multi_file_document", `páginas de ${files.size} archivos distintos unidas en un documento`, d.id);
    const outOfOrder = d.parts.some((p, i) => i > 0 && (p.fileIndex < d.parts[i - 1].fileIndex || (p.fileIndex === d.parts[i - 1].fileIndex && p.page <= d.parts[i - 1].page)));
    if (outOfOrder) add("pages_out_of_order", "las páginas del documento no siguen el orden de los archivos", d.id);
    const pages = body + (d.annexes ?? []).reduce((n, a) => n + a.parts.length, 0);
    if (pages > CLEAN_MAX_PAGES) add("long_document", `${pages} páginas (más de ${CLEAN_MAX_PAGES} siempre se revisan)`, d.id);
    if (d.isBilingualDuplicate) add("bilingual_duplicate", "contenido duplicado en dos idiomas: las palabras se cuentan a la mitad", d.id);
    const words = d.words ?? d.estimatedWords;
    const agrees = Math.abs(words - d.estimatedWords) <= WORDS_AGREEMENT * Math.max(1, d.estimatedWords);
    if (d.wordsBasis === "exact" && !agrees) add("words_mismatch", `${words} palabras contadas frente a ${d.estimatedWords} estimadas`, d.id);
    const exact = d.wordsBasis === "exact" && agrees;
    if (!exact) {
      const near = WORD_THRESHOLDS.find((t) => Math.abs(words - t) <= t * THRESHOLD_MARGIN);
      if (near !== undefined) add("words_near_threshold", `${words} palabras estimadas, cerca del umbral de ${near}`, d.id);
    }
    if ((d.sourceLang || "").trim().toLowerCase() === "fr" && target === "es") {
      const price = priceFrToEs({ docType: d.type, category: d.category, pages: body, words, apostille: d.apostille !== null, apostilleOnSeparatePage: false });
      if (price.kind === "priced") {
        if (price.rule === "perWord") add("per_word_price", "documento que se cobra por palabras", d.id);
        const dependsOnWords = price.rule === "perWord" || price.rule === "perDocument";
        if (dependsOnWords && !exact) add("words_estimated_price", `el precio depende de las palabras (${price.rule}) y están estimadas, no contadas`, d.id);
        const received = body + sheets;
        if (price.cents < pageFloorCents(received)) add("price_below_floor", `precio bajo para ${received} página(s): ${price.cents / 100} € < ${pageFloorCents(received) / 100} €`, d.id);
      } else add("no_tariff", `sin tarifa francesa aplicable: ${price.reason}`, d.id);
    } else add("pair_without_tariff", `par ${(d.sourceLang || "?").trim().toLowerCase()}→${target || "?"}: solo francés→español tiene tarifa automática`, d.id);
  }
  return { clean: reasons.length === 0, reasons };
}
