// Una entrada = un lead para el vigía y el aviso de SLA, cruzado con su caso. Sus archivos (DocumentAnalysis
// «entrada:<id>») no cuentan como leads sueltos, y una entrada «sin jurado» no es un lead que recuperar.
import { sessionKeyOf } from "./store.ts";

export const ENTRADA_SESSION_PREFIX = "entrada:";
const SITE = "https://www.traduccionesjuradas.net";

export type EntradaParaLead = {
  id: string;
  estado: string;
  casoId: string | null;
  email: string | null;
  phone9: string | null;
  nombre: string | null;
  sourceLang: string | null;
  targetLang: string | null;
  urgency: string | null;
  neededBy: Date | null;
  createdAt: Date;
  files: { name: string; sha256: string | null }[];
};

export type EntradaLead = {
  clientEmail: string | null;
  clientName: string | null;
  clientPhone: string | null;
  sessionToken: string;
  fileHash: string | null;
  fileName: string;
  documentType: null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  estimatedWords: null;
  quoteAmount: null;
  marketingConsent: boolean;
  createdAt: Date;
  urgency: string | null;
  neededBy: Date | null;
  link: string;
};

export function entradaLeads(entradas: EntradaParaLead[]): EntradaLead[] {
  return entradas
    .filter((e) => e.estado !== "sin_jurado" && e.files.length > 0 && (e.email || e.phone9))
    .map((e) => ({
      clientEmail: e.email,
      clientName: e.nombre,
      clientPhone: e.phone9,
      sessionToken: sessionKeyOf(e.id),
      fileHash: e.files.find((f) => f.sha256)?.sha256 ?? null,
      fileName: e.files.length === 1 ? e.files[0].name : `${e.files.length} archivos`,
      documentType: null,
      sourceLanguage: e.sourceLang,
      targetLanguage: e.targetLang ?? "unknown",
      estimatedWords: null,
      quoteAmount: null,
      marketingConsent: true,
      createdAt: e.createdAt,
      urgency: e.urgency,
      neededBy: e.neededBy,
      link: e.casoId ? `${SITE}/zona-traductor/lectura?caso=${encodeURIComponent(e.casoId)}` : `${SITE}/zona-traductor/lectura?session=${encodeURIComponent(sessionKeyOf(e.id))}`,
    }));
}

/** Funnel: one entrada counts once whatever its number of files. analizado = it was read; lead = it left a contact. */
export function entradaFunnel(entradas: { loteId: string | null; email: string | null; phone9: string | null; files: number }[]): { analizado: number; lead: number } {
  const withFiles = entradas.filter((e) => e.files > 0);
  return { analizado: withFiles.filter((e) => e.loteId).length, lead: withFiles.filter((e) => e.email || e.phone9).length };
}
