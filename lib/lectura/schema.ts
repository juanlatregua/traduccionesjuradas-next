// Contract of the batch reading: TS types (what the rest of the code uses) and the JSON Schema
// for structured output (what travels on the wire).
//
// The wire schema is flatter than the contract because the API compiles it into a grammar with a
// size limit ("compiled grammar is too large", measured 18-nov-2026): page references travel as
// "N.p" strings, annexes as "label :: N.p N.p" strings, and absent values as "" / 0 / {present:false}
// instead of null (no unions at all).
// `fromWire` turns it into the contract and reports malformed references as errors for the retry.

export const DOCUMENT_TYPES = [
  "birth_certificate", "marriage_certificate", "death_certificate", "divorce_decree", "criminal_record",
  "passport", "id_card", "degree", "transcript", "grades", "contract", "power_of_attorney",
  "company_registration", "payslip", "tax_return", "bank_statement", "medical_report", "apostille", "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_CATEGORIES = ["civil_registry", "identity", "academic", "legal", "financial", "labor", "immigration", "medical", "other"] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const NOT_TO_TRANSLATE_KINDS = ["identity_doc", "payment_proof", "screenshot", "previous_translation", "blank", "other"] as const;
export const TARGET_LANG_BASES = ["stated_by_client", "inferred_from_documents", "inferred_from_instructions", "unknown"] as const;
export const LEGIBILITY = ["good", "medium", "illegible"] as const;
export const APOSTILLE_MATCH = ["on_document_page", "apostille_names_document", "physical_continuity", "weak"] as const;
export const QUESTION_KINDS = ["target_lang", "missing_pages", "apostille_owner", "illegible", "grouping", "document_type", "purpose", "other"] as const;

export type Part = { fileIndex: number; page: number };

export type ReadDocumentRaw = {
  id: string;
  type: DocumentType;
  category: DocumentCategory;
  typeLabelEs: string;
  holder: string | null;
  issuingCountry: string | null;
  sourceLang: string;
  /** Body pages, in reading order. */
  parts: Part[];
  /** Only for a notarial deed that declares or numbers its annexes: those pages belong to the deed. */
  annexes: { labelEs: string; parts: Part[] }[];
  /** Own sheets of the apostille/legalization; empty parts + onDocumentPage when stamped on a document page. */
  /** number: as read on the apostille, null when not clearly legible. matchedBy: the evidence that ties it to this document. */
  apostille: { parts: Part[]; onDocumentPage: boolean; number: string | null; matchedBy: (typeof APOSTILLE_MATCH)[number] } | null;
  declaredPages: number | null;
  missingPages: number[];
  legibility: (typeof LEGIBILITY)[number];
  estimatedWords: number;
  hasTables: boolean;
  hasHandwriting: boolean;
  isBilingualDuplicate: boolean;
  confidence: number;
  groupingReason: string;
};

export type ModelReading = {
  documents: ReadDocumentRaw[];
  notToTranslate: { parts: Part[]; kind: (typeof NOT_TO_TRANSLATE_KINDS)[number]; reason: string }[];
  duplicates: { parts: Part[]; duplicateOf: { documentId: string | null; parts: Part[] } }[];
  instructions: { parts: Part[]; authority: string | null; country: string | null; procedure: string | null; requirements: string[] } | null;
  targetLang: string;
  targetLangBasis: (typeof TARGET_LANG_BASES)[number];
  deadline: string | null;
  clientLang: string | null;
  questions: { kind: (typeof QUESTION_KINDS)[number]; aboutParts: Part[]; aboutDocumentId: string | null; textEs: string }[];
};

type Schema = Record<string, unknown>;
const str = (description?: string): Schema => (description ? { type: "string", description } : { type: "string" });
const int = (description?: string): Schema => (description ? { type: "integer", description } : { type: "integer" });
const bool = (description?: string): Schema => (description ? { type: "boolean", description } : { type: "boolean" });
const enumOf = (values: readonly string[]): Schema => ({ type: "string", enum: [...values] });
const obj = (properties: Record<string, Schema>): Schema => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items: Schema, description?: string): Schema => ({ type: "array", items, ...(description ? { description } : {}) });
const PARTS = (description: string) => arr(str(), `${description}. Cada página como "N.p" (archivo N, página p), p. ej. "2.1"`);

export const READING_JSON_SCHEMA: Schema = obj({
  documents: arr(obj({
    id: str("D1, D2, … en el orden en que aparecen"),
    type: enumOf(DOCUMENT_TYPES),
    category: enumOf(DOCUMENT_CATEGORIES),
    typeLabelEs: str("Qué es, en español, como lo diría un traductor jurado"),
    holder: str("Titular tal como se lee; vacío si no se lee con claridad"),
    issuingCountry: str("ISO 3166-1 alfa-2 del país emisor; vacío si no consta"),
    sourceLang: str("ISO 639-1 del idioma que se traduce; unknown si no se reconoce"),
    parts: PARTS("Páginas del cuerpo del documento en orden de lectura, sin anexos ni hojas propias de la apostilla"),
    annexes: arr(str(), 'Solo en actas notariales que declaran o numeran sus anexos; vacío en los demás. Cada anexo como "qué es :: N.p N.p", p. ej. "Poder notarial :: 2.7 2.8"'),
    apostille: obj({
      present: bool("true si el documento lleva apostilla o legalización"),
      parts: PARTS("Hojas propias de la apostilla; vacío si va estampada en una página del documento o si no hay"),
      onDocumentPage: bool("true si la apostilla está estampada en una página del propio documento"),
      number: str("Número de la apostilla tal como se lee en ella; vacío si no se lee con claridad. Nunca inventado"),
      matchedBy: enumOf(APOSTILLE_MATCH),
    }),
    declaredPages: int("Total de páginas que declara el propio documento; 0 si no declara"),
    missingPages: arr(int(), "Páginas declaradas por el documento que no han llegado"),
    legibility: enumOf(LEGIBILITY),
    estimatedWords: int("Palabras a traducir del documento y su apostilla, contadas como Word"),
    hasTables: bool(),
    hasHandwriting: bool(),
    isBilingualDuplicate: bool("El mismo contenido impreso dos veces en paralelo en dos idiomas"),
    confidence: { type: "number", description: "0 a 1" },
    groupingReason: str("Por qué estas páginas son un documento, en una frase"),
  })),
  notToTranslate: arr(obj({ parts: PARTS("Páginas que no se traducen"), kind: enumOf(NOT_TO_TRANSLATE_KINDS), reason: str() })),
  duplicates: arr(obj({
    parts: PARTS("Páginas repetidas que se descartan"),
    duplicateOfDocumentId: str("Documento que se queda; vacío si se indican páginas"),
    duplicateOfParts: PARTS("Páginas que se quedan, si no es un documento entero"),
  })),
  instructions: obj({
    present: bool("true si hay requerimiento o instrucciones de una administración"),
    parts: PARTS("Páginas del requerimiento; vacío si vienen solo en el mensaje"),
    authority: str(),
    country: str(),
    procedure: str(),
    requirements: arr(str()),
  }),
  targetLang: str("ISO 639-1 del idioma de destino o unknown"),
  targetLangBasis: enumOf(TARGET_LANG_BASES),
  deadline: str("Fecha límite que dijo el cliente: AAAA-MM-DD si se puede, si no tal cual; vacío si no la dijo"),
  clientLang: str("ISO 639-1 del idioma en que escribe el cliente; vacío si no hay mensaje"),
  questions: arr(obj({ kind: enumOf(QUESTION_KINDS), aboutParts: PARTS("Páginas a las que se refiere"), aboutDocumentId: str("Documento al que se refiere; vacío si ninguno"), textEs: str("Pregunta concreta al cliente, en el idioma de las preguntas") })),
});

export const READING_OUTPUT_FORMAT = { type: "json_schema" as const, schema: READING_JSON_SCHEMA };

type WireDoc = Omit<ReadDocumentRaw, "holder" | "issuingCountry" | "parts" | "annexes" | "apostille" | "declaredPages"> & {
  holder: string; issuingCountry: string; parts: string[]; annexes: string[]; apostille: { present: boolean; parts: string[]; onDocumentPage: boolean; number: string; matchedBy: (typeof APOSTILLE_MATCH)[number] }; declaredPages: number;
};
export type WireReading = {
  documents: WireDoc[];
  notToTranslate: { parts: string[]; kind: ModelReading["notToTranslate"][number]["kind"]; reason: string }[];
  duplicates: { parts: string[]; duplicateOfDocumentId: string; duplicateOfParts: string[] }[];
  instructions: { present: boolean; parts: string[]; authority: string; country: string; procedure: string; requirements: string[] };
  targetLang: string;
  targetLangBasis: ModelReading["targetLangBasis"];
  deadline: string;
  clientLang: string;
  questions: { kind: ModelReading["questions"][number]["kind"]; aboutParts: string[]; aboutDocumentId: string; textEs: string }[];
};

export function isWireReading(x: unknown): x is WireReading {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return Array.isArray(r.documents) && Array.isArray(r.notToTranslate) && Array.isArray(r.duplicates) && Array.isArray(r.questions) && typeof r.targetLang === "string" && !!r.instructions && typeof r.instructions === "object";
}

const blank = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

export function fromWire(w: WireReading): { reading: ModelReading; errors: string[] } {
  const errors: string[] = [];
  const parts = (list: string[], where: string): Part[] =>
    (list ?? []).flatMap((s) => {
      const m = /^\s*(\d+)\s*\.\s*(\d+)\s*$/.exec(String(s));
      if (!m) {
        errors.push(`${where}: «${s}» no es una página con formato "N.p".`);
        return [];
      }
      return [{ fileIndex: Number(m[1]), page: Number(m[2]) }];
    });
  const reading: ModelReading = {
    documents: w.documents.map((d) => ({
      ...d,
      holder: blank(d.holder),
      issuingCountry: blank(d.issuingCountry),
      parts: parts(d.parts, `el documento ${d.id}`),
      annexes: (d.annexes ?? []).map((a, i) => {
        const cut = a.lastIndexOf("::");
        if (cut < 0) errors.push(`el anexo ${i + 1} de ${d.id}: «${a}» no sigue el formato "qué es :: N.p N.p".`);
        const pages = cut < 0 ? [] : a.slice(cut + 2).trim().split(/\s+/).filter(Boolean);
        return { labelEs: (cut < 0 ? a : a.slice(0, cut)).trim(), parts: parts(pages, `el anexo ${i + 1} de ${d.id}`) };
      }),
      apostille: d.apostille?.present
        ? { parts: parts(d.apostille.parts, `la apostilla de ${d.id}`), onDocumentPage: !!d.apostille.onDocumentPage, number: d.apostille.number?.trim() ? d.apostille.number.trim() : null, matchedBy: d.apostille.matchedBy }
        : null,
      declaredPages: d.declaredPages > 0 ? d.declaredPages : null,
      missingPages: d.missingPages ?? [],
    })),
    notToTranslate: w.notToTranslate.map((n, i) => ({ ...n, parts: parts(n.parts, `notToTranslate[${i}]`) })),
    duplicates: w.duplicates.map((d, i) => ({
      parts: parts(d.parts, `duplicates[${i}]`),
      duplicateOf: { documentId: blank(d.duplicateOfDocumentId), parts: parts(d.duplicateOfParts, `duplicates[${i}]`) },
    })),
    instructions: w.instructions.present
      ? { parts: parts(w.instructions.parts, "instructions"), authority: blank(w.instructions.authority), country: blank(w.instructions.country), procedure: blank(w.instructions.procedure), requirements: w.instructions.requirements ?? [] }
      : null,
    targetLang: blank(w.targetLang) ?? "unknown",
    targetLangBasis: w.targetLangBasis,
    deadline: blank(w.deadline),
    clientLang: blank(w.clientLang),
    questions: w.questions.map((q, i) => ({ kind: q.kind, aboutParts: parts(q.aboutParts, `questions[${i}]`), aboutDocumentId: blank(q.aboutDocumentId), textEs: q.textEs })),
  };
  const ins = w.instructions;
  if (!ins.present && ((ins.parts ?? []).length > 0 || blank(ins.authority) || blank(ins.country) || blank(ins.procedure) || (ins.requirements ?? []).length > 0)) {
    errors.push("instructions trae datos pero present es false: o present es true, o todo vacío.");
  }
  w.documents.forEach((d) => {
    if (!d.apostille?.present && ((d.apostille?.parts ?? []).length > 0 || d.apostille?.onDocumentPage || blank(d.apostille?.number))) {
      errors.push(`La apostilla de ${d.id} trae páginas o onDocumentPage pero present es false.`);
    }
  });
  return { reading, errors };
}

/** Contract → wire, for tests and fakes. */
export function toWire(r: ModelReading): WireReading {
  const s = (ps: Part[]) => ps.map((p) => `${p.fileIndex}.${p.page}`);
  return {
    documents: r.documents.map((d) => ({
      ...d,
      holder: d.holder ?? "",
      issuingCountry: d.issuingCountry ?? "",
      parts: s(d.parts),
      annexes: d.annexes.map((a) => `${a.labelEs} :: ${s(a.parts).join(" ")}`),
      apostille: d.apostille
        ? { present: true, parts: s(d.apostille.parts), onDocumentPage: d.apostille.onDocumentPage, number: d.apostille.number ?? "", matchedBy: d.apostille.matchedBy }
        : { present: false, parts: [], onDocumentPage: false, number: "", matchedBy: "weak" },
      declaredPages: d.declaredPages ?? 0,
    })),
    notToTranslate: r.notToTranslate.map((n) => ({ ...n, parts: s(n.parts) })),
    duplicates: r.duplicates.map((d) => ({ parts: s(d.parts), duplicateOfDocumentId: d.duplicateOf.documentId ?? "", duplicateOfParts: s(d.duplicateOf.parts) })),
    instructions: r.instructions
      ? { present: true, parts: s(r.instructions.parts), authority: r.instructions.authority ?? "", country: r.instructions.country ?? "", procedure: r.instructions.procedure ?? "", requirements: r.instructions.requirements }
      : { present: false, parts: [], authority: "", country: "", procedure: "", requirements: [] },
    targetLang: r.targetLang,
    targetLangBasis: r.targetLangBasis,
    deadline: r.deadline ?? "",
    clientLang: r.clientLang ?? "",
    questions: r.questions.map((q) => ({ kind: q.kind, aboutParts: s(q.aboutParts), aboutDocumentId: q.aboutDocumentId ?? "", textEs: q.textEs })),
  };
}
