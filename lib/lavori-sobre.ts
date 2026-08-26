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
      contentType: sniffContentType(doc.buf, doc.name, doc.type),
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

// Tipo real del documento: primero por bytes (magic), luego por extensión, y por
// último lo declarado. Antes `doc.type || "application/pdf"` mandaba un JPG sin
// tipo como PDF y lavori lo rechazaba por el magic %PDF- (caso 26-ago, JPG de la
// puerta). image/jpg (no estándar) se normaliza a image/jpeg.
export function sniffContentType(buf: Buffer, name: string, declared?: string | null): string {
  if (buf.length >= 4) {
    if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
    if (buf[0] === 0x89 && buf.subarray(1, 4).toString("latin1") === "PNG") return "image/png";
    if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
    if (buf.length >= 12 && buf.subarray(4, 8).toString("latin1") === "ftyp" && /^(heic|heix|mif1|heif)/.test(buf.subarray(8, 12).toString("latin1"))) return "image/heic";
  }
  const ext = (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1];
  const byExt: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heic" };
  if (ext && byExt[ext]) return byExt[ext];
  const d = String(declared || "").toLowerCase().trim();
  if (d === "image/jpg") return "image/jpeg";
  return d || "application/pdf";
}
