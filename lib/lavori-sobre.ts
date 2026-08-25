// Empaquetado de documentos para el sobre de lavori (adenda 25-ago-2026: por
// URL + bytes + sha256). SOLO SERVIDOR: usa node:crypto; lib/lavori-bridge.ts
// no puede importarlo porque lo cargan componentes cliente.
import { createHash } from "node:crypto";
import { SOBRE_MAX_FILE_BYTES, type BridgeDoc } from "@/lib/lavori-bridge";

/** Prepara un documento del Blob del motor para el sobre: se descarga aquí solo
 * para medirlo y firmarlo (bytes + sha256); lavori lo vuelve a descargar por URL
 * y rechaza el envío si no cuadra. Tope por fichero = el de lavori (15 MB). */
export async function checkDocForSobre(doc: {
  url: string;
  name: string;
  type: string;
}): Promise<{ ok: true; doc: BridgeDoc } | { ok: false; error: string }> {
  let buf: Buffer;
  try {
    const res = await fetch(doc.url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return { ok: false, error: `"${doc.name}": el documento no está disponible (${res.status})` };
    buf = Buffer.from(await res.arrayBuffer());
  } catch {
    return { ok: false, error: `"${doc.name}": no se pudo descargar del Blob` };
  }
  return describeDocForSobre({ url: doc.url, name: doc.name, type: doc.type, buf });
}

/** Firma unos bytes ya descargados para el sobre (mismo tope que checkDocForSobre). */
export function describeDocForSobre(doc: {
  url: string;
  name: string;
  type: string;
  buf: Buffer;
}): { ok: true; doc: BridgeDoc } | { ok: false; error: string } {
  if (doc.buf.length === 0) return { ok: false, error: `"${doc.name}": el documento llegó vacío` };
  if (doc.buf.length > SOBRE_MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `"${doc.name}" pesa ${(doc.buf.length / 1e6).toFixed(1)} MB y lavori admite ${Math.round(SOBRE_MAX_FILE_BYTES / 1e6)} MB por fichero`,
    };
  }
  return {
    ok: true,
    doc: {
      nombre: doc.name,
      contentType: doc.type || "application/pdf",
      url: doc.url,
      bytes: doc.buf.length,
      sha256: createHash("sha256").update(doc.buf).digest("hex"),
    },
  };
}

/* Prepara TODOS los documentos de una solicitud para el sobre. Todo o nada: si
   uno no es descargable o pasa del tope por fichero NO se manda un expediente
   incompleto (el traductor cotizaría a ciegas); el llamador avisa a staff. */
export async function packDocsForSobre(
  docs: { url: string; name: string; type: string }[],
): Promise<{ ok: true; documentos: BridgeDoc[] } | { ok: false; error: string }> {
  const documentos: BridgeDoc[] = [];
  for (const doc of docs) {
    const r = await checkDocForSobre(doc);
    if (!r.ok) return r;
    documentos.push(r.doc);
  }
  if (documentos.length === 0) {
    return { ok: false, error: "el pedido no tiene documentos descargables" };
  }
  return { ok: true, documentos };
}
