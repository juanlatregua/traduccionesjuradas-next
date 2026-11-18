import { priceFrToEs, type FrPrice } from "../dinero/tariff-fr.ts";
import type { ReadDocumentRaw } from "./schema.ts";

export type PriceHint =
  | { kind: "fr_es"; price: FrPrice }
  | { kind: "none"; reasonEs: string };

/** Informative only. French → Spanish uses the published tariff; everything else has no automatic tariff. */
export function priceHint(
  document: Pick<ReadDocumentRaw, "type" | "category" | "sourceLang" | "parts" | "apostille"> & { words?: number | null; estimatedWords?: number },
  targetLang: string,
): PriceHint {
  const source = (document.sourceLang || "").toLowerCase();
  const target = (targetLang || "").toLowerCase();
  if (source !== "fr" || target !== "es") return { kind: "none", reasonEs: "sin tarifa automática" };
  return {
    kind: "fr_es",
    price: priceFrToEs({
      docType: document.type,
      category: document.category,
      pages: document.parts.length,
      words: document.words ?? document.estimatedWords ?? null,
      apostille: document.apostille !== null,
      // The apostille sheets are already outside `parts`: nothing to discount.
      apostilleOnSeparatePage: false,
    }),
  };
}
