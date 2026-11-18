import { PDFDocument, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import type { ModelReading, ReadDocumentRaw } from "../../../lib/lectura/schema.ts";

/** PDF whose page i carries `texts[i]` as a text layer ("" = blank page, like a scan without text). */
export async function makePdf(texts: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const t of texts) {
    const page = doc.addPage([595, 842]);
    const words = t.split(/\s+/).filter(Boolean);
    for (let line = 0; line * 10 < words.length; line++) {
      page.drawText(words.slice(line * 10, line * 10 + 10).join(" "), { x: 40, y: 800 - line * 14, size: 10, font });
    }
  }
  return doc.save();
}

export async function makeImage(format: "png" | "jpeg" | "tiff" | "webp", width = 300, height = 400, color = "#336699"): Promise<Uint8Array> {
  const img = sharp({ create: { width, height, channels: 3, background: color } });
  const buf = format === "png" ? await img.png().toBuffer() : format === "jpeg" ? await img.jpeg().toBuffer() : format === "tiff" ? await img.tiff().toBuffer() : await img.webp().toBuffer();
  return new Uint8Array(buf);
}

export const lorem = (n: number, seed = "palabra") => Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ");

export function doc(id: string, parts: [number, number][], extra: Partial<ReadDocumentRaw> = {}): ReadDocumentRaw {
  return {
    id,
    type: "birth_certificate",
    category: "civil_registry",
    typeLabelEs: "Certificado de nacimiento",
    holder: null,
    issuingCountry: "FR",
    sourceLang: "fr",
    parts: parts.map(([fileIndex, page]) => ({ fileIndex, page })),
    apostille: null,
    declaredPages: null,
    missingPages: [],
    legibility: "good",
    estimatedWords: 200,
    hasTables: false,
    hasHandwriting: false,
    isBilingualDuplicate: false,
    confidence: 0.9,
    groupingReason: "mismo titular y numeración",
    ...extra,
  };
}

export function reading(documents: ReadDocumentRaw[], extra: Partial<ModelReading> = {}): ModelReading {
  return {
    documents,
    notToTranslate: [],
    duplicates: [],
    instructions: null,
    targetLang: "es",
    targetLangBasis: "inferred_from_documents",
    deadline: null,
    clientLang: null,
    questions: [],
    ...extra,
  };
}

export const files = (counts: number[]) => ({ files: counts.map((pageCount, i) => ({ index: i + 1, pageCount })) }) as never;
