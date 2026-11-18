import { priceFrToEs, type FrPrice } from "../dinero/tariff-fr.ts";
import type { Assessment, ReviewReason } from "./assess.ts";
import type { ReadDocumentRaw } from "./schema.ts";

export type PriceHint =
  | { kind: "fr_es"; price: FrPrice; needsReview: ReviewReason[] }
  | { kind: "none"; reasonEs: string; needsReview: ReviewReason[] };

const lang = (s: string | null | undefined) => (s || "").trim().toLowerCase();

/**
 * Informative only. French → Spanish uses the published tariff; everything else has no automatic tariff.
 * `needsReview` carries the batch-level reasons and this document's own: only an empty list may ever price unattended.
 */
export function priceHint(
  document: Pick<ReadDocumentRaw, "id" | "type" | "category" | "sourceLang" | "parts" | "apostille"> & { annexes?: ReadDocumentRaw["annexes"]; words?: number | null; estimatedWords?: number },
  targetLang: string,
  assessment?: Assessment,
): PriceHint {
  const needsReview = assessment
    ? assessment.reasons.filter((r) => r.documentId === undefined || r.documentId === document.id)
    : [{ code: "not_assessed" as const, detail: "sin evaluación de la lectura" }];
  if (lang(document.sourceLang) !== "fr" || lang(targetLang) !== "es") return { kind: "none", reasonEs: "sin tarifa automática", needsReview };
  return {
    kind: "fr_es",
    needsReview,
    price: priceFrToEs({
      docType: document.type,
      category: document.category,
      pages: document.parts.length + (document.annexes ?? []).reduce((n, a) => n + a.parts.length, 0),
      words: document.words ?? document.estimatedWords ?? null,
      apostille: document.apostille !== null,
      // The apostille sheets are already outside `parts`: nothing to discount.
      apostilleOnSeparatePage: false,
    }),
  };
}
