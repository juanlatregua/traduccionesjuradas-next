// Ficheros grandes de lavori → motor (6-nov-2026). Vercel corta con 413 cualquier
// cuerpo de más de ~4,5 MB antes de llegar a la función, así que una entrega en
// base64 de más de 3 MB no llegaba nunca (escritura de cuotas de Nielson, 26_3D3B0C).
// Carril nuevo: lavori pide un token a /api/lavori/subida, sube el fichero DIRECTO
// a nuestro Blob con put(pathname, buf, { token }) y manda el evento con
// datos.blobUrl. Aquí solo se acepta un blob de NUESTRO almacén (head() con
// nuestro token) y bajo el prefijo de ese motorRef.
import { head } from "@vercel/blob";

export const LAVORI_UPLOAD_MAX_BYTES = 50_000_000;
export const LAVORI_UPLOAD_PREFIX = "lavori-subidas";
export const LAVORI_UPLOAD_CONTENT_TYPES = [
  "application/pdf",
  "image/*",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function safeRefSegment(motorRef: string): string {
  return String(motorRef || "").trim().replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 80);
}

export function safeFileName(nombre: string): string {
  const n = String(nombre || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\- ]+/g, "_").trim();
  return (n || "archivo").slice(0, 120);
}

// La carpeta lleva el mismo nombre que la vía base64: lib/delivery-files.ts reconoce
// una entrega del traductor (nunca visible al cliente sin revisar) por "/entregas-lavori/".
const FOLDER = { entrega: "entregas-lavori", factura: "facturas-lavori" } as const;

export function lavoriUploadPathname(motorRef: string, tipo: "entrega" | "factura", nombre: string, now = Date.now()): string {
  return `${LAVORI_UPLOAD_PREFIX}/${safeRefSegment(motorRef)}/${FOLDER[tipo]}/${now}-${safeFileName(nombre)}`;
}

/** El pathname de un blob subido por lavori para ESTE motorRef y tipo. */
export function isLavoriUploadPathFor(pathname: string, motorRef: string, tipo: "entrega" | "factura"): boolean {
  const p = String(pathname || "").replace(/^\/+/, "");
  return p.startsWith(`${LAVORI_UPLOAD_PREFIX}/${safeRefSegment(motorRef)}/${FOLDER[tipo]}/`);
}

export type LavoriBlob = { url: string; pathname: string; bytes: number; contentType: string };

/** Comprueba datos.blobUrl: existe en nuestro Blob, prefijo correcto, tamaño ≤ tope. */
export async function verifyLavoriBlob(
  blobUrl: unknown,
  motorRef: string,
  tipo: "entrega" | "factura"
): Promise<{ ok: true; blob: LavoriBlob } | { ok: false; error: string }> {
  const url = typeof blobUrl === "string" ? blobUrl.trim() : "";
  if (!/^https:\/\//.test(url)) return { ok: false, error: "datos.blobUrl inválido" };
  let meta;
  try {
    meta = await head(url);
  } catch {
    return { ok: false, error: "datos.blobUrl no está en el almacén del motor" };
  }
  if (!isLavoriUploadPathFor(meta.pathname, motorRef, tipo)) {
    return { ok: false, error: "datos.blobUrl fuera del prefijo de este encargo" };
  }
  if (!meta.size || meta.size > LAVORI_UPLOAD_MAX_BYTES) {
    return { ok: false, error: `fichero vacío o >${Math.round(LAVORI_UPLOAD_MAX_BYTES / 1e6)}MB` };
  }
  return { ok: true, blob: { url: meta.url, pathname: meta.pathname, bytes: meta.size, contentType: meta.contentType } };
}
