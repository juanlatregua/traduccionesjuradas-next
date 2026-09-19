// lib/document-dedup.ts — Un documento es su CONTENIDO, no su subida.
//
// El problema (19-sep-2026): cada vez que un fichero se subía otra vez nacía
// una fila nueva de DocumentAnalysis, con otra URL y otro id, así que el caché
// por documentId nunca acertaba y se volvía a llamar a Claude. Medido desde el
// 1-ago: 28 análisis repetidos de 359 (8 %), con `CamScanner.pdf` analizado 7
// veces. Y lo caro no era la factura: el MISMO `titulopau.pdf` devolvió 1.850
// palabras y luego 1.254 — dos precios distintos para el mismo papel.
//
// La regla (orden de Juan): un cliente no vuelve a pagar —ni a esperar— el
// análisis del mismo documento. Se reutiliza el análisis gemelo.
//
// Solo se reutiliza DENTRO del mismo cliente (su email o su sesión): el
// análisis lleva nombres y fechas extraídos del documento, así que copiarlo
// entre clientes distintos movería datos personales de una ficha a otra aunque
// el fichero coincida. Con el mismo email o la misma sesión no hay tal salto.

import { createHash } from "crypto";

/** sha256 en hex del fichero tal cual se subió. */
export function hashFileBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export type TwinCandidate = {
  id: string;
  status: string;
  analysisJson: unknown;
  clientEmail?: string | null;
  sessionToken?: string | null;
  createdAt: Date;
};

export type TwinOwner = {
  documentId: string;
  clientEmail?: string | null;
  sessionToken?: string | null;
};

/** Estados cuyo análisis está completo y es reutilizable. */
const REUSABLE = new Set(["ANALYZED", "QUOTE_GENERATED"]);

/**
 * Elige el análisis gemelo reutilizable de entre los candidatos con el mismo
 * hash. Puro (sin Prisma) para poder probarlo. Devuelve null si no hay ninguno
 * que cumpla: análisis completo, con JSON, del mismo cliente y no él mismo.
 */
export function pickReusableTwin(
  candidates: TwinCandidate[],
  owner: TwinOwner
): TwinCandidate | null {
  const email = (owner.clientEmail || "").trim().toLowerCase();
  const token = (owner.sessionToken || "").trim();

  const validos = candidates.filter((c) => {
    if (c.id === owner.documentId) return false;
    if (!REUSABLE.has(c.status)) return false;
    if (!c.analysisJson) return false;
    const mismoEmail = Boolean(email) && (c.clientEmail || "").trim().toLowerCase() === email;
    const mismaSesion = Boolean(token) && (c.sessionToken || "").trim() === token;
    return mismoEmail || mismaSesion;
  });
  if (validos.length === 0) return null;

  // El más reciente: si el cliente subió una versión mejor escaneada del mismo
  // fichero, su análisis es el que vale.
  return validos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}
