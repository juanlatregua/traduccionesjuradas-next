// Empaquetado de documentos para el sobre de lavori (adenda 25-ago-2026: por
// URL + bytes + sha256). SOLO SERVIDOR: usa node:crypto; lib/lavori-bridge.ts
// no puede importarlo porque lo cargan componentes cliente.
import { createHash } from "node:crypto";
import { SOBRE_MAX_DOCS, SOBRE_MAX_FILE_BYTES, SOBRE_MAX_TOTAL_BYTES, type BridgeDoc } from "@/lib/lavori-bridge";

/** Prepara un documento del Blob del motor para el sobre: se descarga aquí solo
 * para medirlo y firmarlo (bytes + sha256); lavori lo vuelve a descargar por URL
 * y rechaza el envío si no cuadra. Tope por fichero = el de lavori (15 MB). */
export async function checkDocForSobre(doc: {
  url: string;
  name: string;
  type: string;
}): Promise<{ ok: true; doc: BridgeDoc } | { ok: false; error: string }> {
  // Se lee A TROZOS (hash y tamaño sobre la marcha): un expediente de cientos de MB
  // no se carga entero en la memoria de la función (24-sep-2026).
  const hash = createHash("sha256");
  let bytes = 0;
  let head = Buffer.alloc(0);
  try {
    const res = await fetch(doc.url, { signal: AbortSignal.timeout(180_000) });
    if (!res.ok || !res.body) return { ok: false, error: `"${doc.name}": el documento no está disponible (${res.status})` };
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > SOBRE_MAX_FILE_BYTES) {
        await reader.cancel().catch(() => {});
        return { ok: false, error: `"${doc.name}" pasa de ${Math.round(SOBRE_MAX_FILE_BYTES / 1e6)} MB, el máximo de lavori por fichero` };
      }
      if (head.length < 16) head = Buffer.concat([head, Buffer.from(value.subarray(0, 16 - head.length))]);
      hash.update(value);
    }
  } catch {
    return { ok: false, error: `"${doc.name}": no se pudo descargar del Blob` };
  }
  if (bytes === 0) return { ok: false, error: `"${doc.name}": el documento llegó vacío` };
  return {
    ok: true,
    doc: { nombre: doc.name, contentType: sniffContentType(head, doc.name, doc.type), url: doc.url, bytes, sha256: hash.digest("hex") },
  };
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
  if (docs.length > SOBRE_MAX_DOCS) return { ok: false, error: `son ${docs.length} documentos y lavori admite ${SOBRE_MAX_DOCS} por encargo` };
  const documentos: BridgeDoc[] = [];
  let total = 0;
  for (const doc of docs) {
    const r = await checkDocForSobre(doc);
    if (!r.ok) return r;
    total += r.doc.bytes;
    if (total > SOBRE_MAX_TOTAL_BYTES) return { ok: false, error: "el expediente pasa de 3 GB, el máximo de lavori por encargo" };
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
  // .xlsx (zip por dentro, «PK»): lavori lo admite desde bf60d2a; .xls no.
  if (ext === "xlsx" && buf.subarray(0, 2).toString("latin1") === "PK") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const byExt: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heic" };
  if (ext && byExt[ext]) return byExt[ext];
  const d = String(declared || "").toLowerCase().trim();
  if (d === "image/jpg") return "image/jpeg";
  return d || "application/pdf";
}
