import { FR_DOC_LONG_WORDS, FR_DOC_MAX_PAGES, FR_WORD_CENTS, FR_WORD_MIN_CENTS, FR_WORD_MIN_MULTIPAGE_CENTS, priceFrToEs } from "../dinero/tariff-fr.ts";
import type { PreparedBatch } from "./prepare.ts";
import type { DocumentType, ModelReading, ReadDocumentRaw } from "./schema.ts";

// Deterministic guard. What the model declares cannot be checked in code, so «clean» only rests on structure:
// every received page is a body page (one apostille sheet per document at most), nothing set aside, nothing merged
// across files, no repeated types, words counted (not estimated) whenever the price depends on them, and a price
// floor per page. Anything else goes to a person. Only a clean reading may ever price without one.

export type ReviewCode =
  | "not_to_translate" | "model_duplicates" | "instructions_pages" | "nothing_to_translate" | "apostille_sheets" | "loose_apostille"
  | "missing_pages" | "declared_pages_mismatch" | "pages_unverified" | "legibility" | "low_confidence" | "type_other"
  | "words_near_threshold" | "words_estimated_price" | "price_below_floor" | "same_type_repeated" | "multi_file_document"
  | "skipped_files" | "target_basis" | "questions" | "annexes" | "apostille_number_unread" | "apostille_pairing_weak" | "not_assessed";
export type ReviewReason = { code: ReviewCode; detail: string; documentId?: string };
export type Assessment = { clean: boolean; reasons: ReviewReason[] };

export const MIN_CONFIDENCE = 0.85;
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
    const words = d.words ?? d.estimatedWords;
    const exact = d.wordsBasis === "exact";
    if (!exact) {
      const near = WORD_THRESHOLDS.find((t) => Math.abs(words - t) <= t * THRESHOLD_MARGIN);
      if (near !== undefined) add("words_near_threshold", `${words} palabras estimadas, cerca del umbral de ${near}`, d.id);
    }
    if ((d.sourceLang || "").trim().toLowerCase() === "fr" && target === "es") {
      const price = priceFrToEs({ docType: d.type, category: d.category, pages: body, words, apostille: d.apostille !== null, apostilleOnSeparatePage: false });
      if (price.kind === "priced") {
        const dependsOnWords = price.rule === "perWord" || price.rule === "perDocument";
        if (dependsOnWords && !exact) add("words_estimated_price", `el precio depende de las palabras (${price.rule}) y están estimadas, no contadas`, d.id);
        const received = body + sheets;
        if (price.cents < pageFloorCents(received)) add("price_below_floor", `precio bajo para ${received} página(s): ${price.cents / 100} € < ${pageFloorCents(received) / 100} €`, d.id);
      }
    }
  }
  return { clean: reasons.length === 0, reasons };
}
