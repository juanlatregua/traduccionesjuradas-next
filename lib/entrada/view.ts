// Lo que ve el cliente: documentos, lo que falta y lo que no se incluye. Nunca precios, palabras ni tarifas.
import { labelOf, type WorkingDocument } from "../lectura-constructor/documents.ts";
import type { FileRow, LoteRow } from "../lectura-constructor/store.ts";
import { sessionKeyOf, type ArchivoRow, type EntradaRow } from "./store.ts";

export const MAEC_URL = "https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Buscador-STIJ.aspx";

type PartRef = { fileIndex: number; page: number };
type Part = PartRef;
export type ReadingExtras = {
  notToTranslate: { parts: PartRef[]; reason: string }[];
  duplicates: { parts: PartRef[] }[];
  questions: { textEs: string }[];
  /** docKey (D1, D2…) → pages the document declares and did not arrive. */
  missing: Record<string, number[]>;
};

export type LoteData = { lote: LoteRow; files: FileRow[]; documents: WorkingDocument[] };

export type ClientDocument = {
  id: string;
  titulo: string;
  paginas: number;
  apostilla: boolean;
  faltan: number[];
  ilegible: boolean;
  incluido: boolean;
  motivo: string | null;
  /** Its pages in reading order, pointing at the client's own files (for the thumbnails). */
  partes: { archivoId: string; page: number; rol: "pagina" | "anexo" | "apostilla" }[];
};

export type ClientView = {
  estado: EntradaRow["estado"];
  email: string | null;
  emailVerificado: boolean;
  archivos: Pick<ArchivoRow, "id" | "name" | "url" | "mimeType" | "size" | "pages">[];
  lectura:
    | null
    | {
        fase: "leyendo" | "lista" | "revision_manual";
        loteUpdatedAt: string;
        editable: boolean;
        targetLang: string | null;
        documentos: ClientDocument[];
        noIncluidos: { que: string; motivo: string }[];
        preguntas: string[];
        resumen: string;
      };
  sinJurado: null | { idioma: string; codigo: string; maecUrl: string };
  plazo: { urgency: string | null; neededBy: string | null };
  organismo: string | null;
  pais: string | null;
  idiomas: { origen: string | null; destinos: string[] };
  /** Why the client cannot change the documents (languages and messages still can). */
  soloLectura: null | "otra_entrada" | "caso_existente";
  /** Solo en la respuesta de la confirmación: el presupuesto ya salió por email (PUERTA_FR=fr). */
  presupuestoEnviado?: boolean;
};

const FASE: Record<string, "leyendo" | "lista" | "revision_manual"> = {
  running: "leyendo", busy: "leyendo", ok: "lista", confirmed: "lista", nothing_to_translate: "lista",
};

export function langName(code: string | null | undefined): string {
  const c = String(code || "").trim().toLowerCase();
  if (!c || c === "unknown") return "otro idioma";
  try {
    return new Intl.DisplayNames(["es"], { type: "language" }).of(c) ?? c.toUpperCase();
  } catch {
    return c.toUpperCase();
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function where(files: FileRow[], parts: PartRef[]): string {
  const byFile = new Map<number, number[]>();
  for (const p of parts) byFile.set(p.fileIndex, [...(byFile.get(p.fileIndex) ?? []), p.page]);
  return [...byFile].map(([i, pages]) => {
    const f = files.find((x) => x.position === i);
    const name = f ? `«${f.name}»` : `archivo ${i}`;
    return f?.pageCount && f.pageCount > 1 ? `${name}, pág. ${pages.join(", ")}` : name;
  }).join("; ");
}

/** The client may only edit a lote read for this entrada alone, in a caso it created. */
export function ownLote(e: Pick<EntradaRow, "id" | "regla">, lote: Pick<LoteRow, "sessionKey">): boolean {
  return lote.sessionKey === sessionKeyOf(e.id) && e.regla !== "huella" && e.regla !== "contacto";
}

/** Lote parts (file position + page) → the entrada's archivo ids; parts of files the client no longer has are dropped. */
export function partesOf(d: Pick<WorkingDocument, "parts" | "annexes" | "apostille">, files: Pick<FileRow, "position" | "url">[], archivos: Pick<ArchivoRow, "id" | "url">[]): ClientDocument["partes"] {
  const idOf = (fileIndex: number) => {
    const url = files.find((f) => f.position === fileIndex)?.url;
    return url ? archivos.find((a) => a.url === url)?.id ?? null : null;
  };
  const out: ClientDocument["partes"] = [];
  const push = (parts: Part[], rol: ClientDocument["partes"][number]["rol"]) => {
    for (const p of parts) {
      const archivoId = idOf(p.fileIndex);
      if (archivoId) out.push({ archivoId, page: p.page, rol });
    }
  };
  push(d.parts, "pagina");
  for (const a of d.annexes ?? []) push(a.parts, "anexo");
  push(d.apostille?.parts ?? [], "apostilla");
  return out;
}

export function clientView(entrada: EntradaRow, archivos: ArchivoRow[], data: LoteData | null, extras: ReadingExtras | null, sinJurado: string | null): ClientView {
  const base: ClientView = {
    estado: entrada.estado,
    email: entrada.email,
    emailVerificado: Boolean(entrada.emailVerifiedAt),
    archivos: archivos.map(({ id, name, url, mimeType, size, pages }) => ({ id, name, url, mimeType, size, pages })),
    lectura: null,
    sinJurado: sinJurado ? { idioma: langName(sinJurado), codigo: sinJurado, maecUrl: MAEC_URL } : null,
    plazo: { urgency: entrada.urgency, neededBy: entrada.neededBy ? entrada.neededBy.toISOString().slice(0, 10) : null },
    organismo: entrada.organismo,
    pais: entrada.pais,
    idiomas: { origen: entrada.sourceLang, destinos: entrada.targetLangs.length ? entrada.targetLangs : entrada.targetLang ? [entrada.targetLang] : [] },
    soloLectura: null,
  };
  if (!data) return base;
  const { lote, files, documents } = data;
  const fase = FASE[lote.status] ?? "revision_manual";
  const documentos: ClientDocument[] = fase === "lista"
    ? documents.map((d) => ({
        id: d.id, titulo: labelOf(d), paginas: d.pageCount, apostilla: Boolean(d.apostille),
        faltan: extras?.missing[d.docKey] ?? [],
        ilegible: d.legibility === "illegible", incluido: d.included, motivo: d.included ? null : d.excludedReason,
        partes: partesOf(d, files, archivos),
      }))
    : [];
  const noIncluidos = fase === "lista"
    ? [
        ...(extras?.notToTranslate ?? []).map((n) => ({ que: where(files, n.parts), motivo: n.reason })),
        ...(extras?.duplicates ?? []).map((d) => ({ que: where(files, d.parts), motivo: "es una copia repetida de otra página" })),
        ...files.filter((f) => f.state === "duplicate" || f.state === "skipped").map((f) => ({ que: `«${f.name}»`, motivo: f.reasonEs ?? "no se ha podido abrir" })),
      ]
    : [];
  const incluidos = documentos.filter((d) => d.incluido).length;
  const resumen = fase === "lista"
    ? `Has subido ${plural(archivos.length, "archivo que corresponde", "archivos que corresponden")} a ${plural(incluidos, "documento", "documentos")}.`
    : fase === "leyendo"
      ? "Estamos revisando el conjunto de tus archivos."
      : "Tus archivos los revisa Juan personalmente.";
  const soloLectura = lote.status !== "ok" ? null : lote.sessionKey !== sessionKeyOf(entrada.id) ? "otra_entrada" : entrada.regla === "huella" || entrada.regla === "contacto" ? "caso_existente" : null;
  return {
    ...base,
    soloLectura,
    lectura: {
      fase,
      loteUpdatedAt: lote.updatedAt.toISOString(),
      editable: lote.status === "ok" && entrada.estado === "leida" && ownLote(entrada, lote),
      targetLang: lote.targetLang && lote.targetLang !== "unknown" ? lote.targetLang : entrada.targetLang,
      documentos,
      noIncluidos,
      preguntas: fase === "lista" ? (extras?.questions ?? []).map((q) => q.textEs).filter(Boolean) : [],
      resumen,
    },
  };
}
