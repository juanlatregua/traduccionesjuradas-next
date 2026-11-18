import { FR_DOC_LONG_WORDS, FR_WORD_CENTS, FR_WORD_MIN_CENTS, FR_WORD_MIN_MULTIPAGE_CENTS } from "../dinero/tariff-fr.ts";
import type { PreparedBatch } from "./prepare.ts";
import type { ModelReading, ReadDocumentRaw } from "./schema.ts";

// Deterministic guard: anything the model says that could lower a price or hide pages sends the batch to a person.
// A client can write instructions inside a document or in a file name; this check does not read text, only structure.

export type ReviewCode =
  | "not_to_translate" | "model_duplicates" | "apostille_sheets" | "loose_apostille" | "missing_pages" | "declared_pages_mismatch"
  | "legibility" | "low_confidence" | "type_other" | "words_near_threshold" | "skipped_files" | "target_basis" | "questions" | "annexes" | "apostille_number_unread" | "apostille_pairing_weak" | "not_assessed";
export type ReviewReason = { code: ReviewCode; detail: string; documentId?: string };
export type Assessment = { clean: boolean; reasons: ReviewReason[] };

export const MIN_CONFIDENCE = 0.85;
export const THRESHOLD_MARGIN = 0.15;
/** Word counts where the French tariff changes band. */
export const WORD_THRESHOLDS = [FR_DOC_LONG_WORDS, Math.ceil(FR_WORD_MIN_CENTS / FR_WORD_CENTS), Math.ceil(FR_WORD_MIN_MULTIPAGE_CENTS / FR_WORD_CENTS)];

type DocWords = ReadDocumentRaw & { words?: number; wordsBasis?: "exact" | "estimated" };

export function assessReading(batch: Pick<PreparedBatch, "skipped">, reading: ModelReading & { documents: DocWords[] }): Assessment {
  const reasons: ReviewReason[] = [];
  const add = (code: ReviewCode, detail: string, documentId?: string) => reasons.push(documentId ? { code, detail, documentId } : { code, detail });

  const ntt = reading.notToTranslate.reduce((s, n) => s + n.parts.length, 0);
  if (ntt > 0) add("not_to_translate", `${ntt} página(s) marcadas como «no se traduce»`);
  const dup = reading.duplicates.reduce((s, d) => s + d.parts.length, 0);
  if (dup > 0) add("model_duplicates", `${dup} página(s) descartadas como repetidas por el modelo`);
  if (batch.skipped.length > 0) add("skipped_files", `${batch.skipped.length} archivo(s) no se pudieron abrir`);
  if (reading.targetLangBasis !== "stated_by_client" && reading.targetLangBasis !== "inferred_from_documents") add("target_basis", `idioma de destino: ${reading.targetLangBasis}`);
  if (reading.questions.length > 0) add("questions", `${reading.questions.length} pregunta(s) pendientes`);

  for (const d of reading.documents) {
    const annexPages = (d.annexes ?? []).reduce((n, a) => n + a.parts.length, 0);
    const pages = d.parts.length + annexPages;
    if ((d.annexes ?? []).length > 0) add("annexes", `${d.annexes.length} anexo(s), ${annexPages} página(s) dentro del documento`, d.id);
    const sheets = d.apostille?.parts.length ?? 0;
    if (sheets > 2 || (sheets > 0 && sheets > pages)) add("apostille_sheets", `${sheets} hoja(s) de apostilla para ${pages} página(s) de documento`, d.id);
    if (d.type === "apostille") add("loose_apostille", "apostilla sin documento", d.id);
    if (d.apostille && !d.apostille.number) add("apostille_number_unread", "número de apostilla no legible", d.id);
    if (d.apostille && d.apostille.matchedBy === "weak") add("apostille_pairing_weak", "apostilla emparejada sin evidencia en el papel", d.id);
    if (d.missingPages.length > 0) add("missing_pages", `faltan ${d.missingPages.length} página(s)`, d.id);
    if (d.declaredPages !== null && d.declaredPages !== pages) add("declared_pages_mismatch", `declara ${d.declaredPages}, llegan ${pages}`, d.id);
    if (d.legibility !== "good") add("legibility", `legibilidad ${d.legibility}`, d.id);
    if (!(d.confidence >= MIN_CONFIDENCE)) add("low_confidence", `confianza ${d.confidence}`, d.id);
    if (d.type === "other") add("type_other", "tipo no reconocido", d.id);
    const words = d.words ?? d.estimatedWords;
    if (d.wordsBasis !== "exact") {
      const near = WORD_THRESHOLDS.find((t) => Math.abs(words - t) <= t * THRESHOLD_MARGIN);
      if (near !== undefined) add("words_near_threshold", `${words} palabras estimadas, cerca del umbral de ${near}`, d.id);
    }
  }
  return { clean: reasons.length === 0, reasons };
}
