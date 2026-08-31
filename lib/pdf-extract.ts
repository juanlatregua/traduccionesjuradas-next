// lib/pdf-extract.ts — Sirve UN documento concreto dentro de un PDF origen,
// extrayendo su rango de páginas (segmentación). Compartido por la ruta de
// staff (/api/documents/extract-pages, que acepta la URL por query) y por la
// del cliente (/api/q/[token]/document, que la saca de la BD).
//
// La comprobación de host vive aquí: cualquier llamador que reciba una URL de
// fuera tiene que pasar por ella o abre un proxy SSRF.

export const BLOB_HOST_RE = /^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\//;

export function isAllowedBlobUrl(url: string): boolean {
  return BLOB_HOST_RE.test(url);
}

export function safeDocName(name: string | null | undefined): string {
  return String(name || "documento").replace(/[^\w.\- ]+/g, "_").slice(0, 80);
}

export type ExtractedDoc = {
  buffer: Buffer;
  contentType: string;
  ext: string;
};

/** Descarga el origen y devuelve el rango [start,end] como PDF propio. */
export async function extractPageRange(opts: {
  url: string;
  start?: number | null;
  end?: number | null;
}): Promise<ExtractedDoc> {
  const start = Math.max(1, Math.round(Number(opts.start) || 1));
  const endRaw = Math.round(Number(opts.end) || start);

  const res = await fetch(opts.url);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const contentType = res.headers.get("content-type") || "application/octet-stream";
  const buffer = Buffer.from(await res.arrayBuffer());

  // Solo se extrae de PDFs. Imágenes u otros → se devuelven tal cual.
  const isPdf = contentType.includes("pdf") || opts.url.toLowerCase().endsWith(".pdf");
  const ext = isPdf ? "pdf" : (opts.url.split(".").pop()?.split("?")[0] || "bin").slice(0, 5);
  if (!isPdf) return { buffer, contentType, ext };

  let outBuffer = buffer;
  try {
    const { PDFDocument } = require("pdf-lib");
    const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const total = src.getPageCount();
    const from = Math.min(start, total);
    const to = Math.min(Math.max(endRaw, from), total);
    // Si el rango cubre todo el documento, servimos el original sin tocar.
    if (!(from === 1 && to === total)) {
      const out = await PDFDocument.create();
      const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
      const copied = await out.copyPages(src, indices);
      copied.forEach((p: any) => out.addPage(p));
      outBuffer = Buffer.from(await out.save());
    }
  } catch (err) {
    console.error("[pdf-extract] pdf-lib error, sirviendo original:", err);
    outBuffer = buffer;
  }
  return { buffer: outBuffer, contentType: "application/pdf", ext: "pdf" };
}
