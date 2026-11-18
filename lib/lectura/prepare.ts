import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import heicConvert from "heic-convert";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { countWords, isReliableTextLayer } from "./words.ts";

export type SourceFile = { name: string; mimeType?: string | null; bytes: Uint8Array };
export type PageRef = { fileIndex: number; page: number };

export type DetectedType = "pdf" | "jpeg" | "png" | "webp" | "gif" | "heic" | "avif" | "tiff" | "zip" | "office" | "unknown";

export type PreparedFile = {
  /** 1-based, as the model sees it («Archivo N»). */
  index: number;
  name: string;
  sha256: string;
  detected: DetectedType;
  kind: "pdf" | "image";
  mediaType: "application/pdf" | "image/jpeg" | "image/png";
  bytes: Uint8Array;
  pageCount: number;
  conversion: string | null;
  /** PDF with an /Encrypt dictionary that opens without a password (owner password only). */
  encrypted: boolean;
  textLayer: boolean;
  /** Text per page (index 0 = page 1) when the PDF has a text layer at all. */
  pageTexts: string[] | null;
};

export type PreparedBatch = {
  files: PreparedFile[];
  duplicateFiles: { name: string; sha256: string; exactDuplicateOf: number }[];
  skipped: { name: string; reasonEs: string }[];
  pages: PageRef[];
  requestBytes: number;
};

export type BatchLimits = {
  maxFiles: number;
  maxPages: number;
  maxRequestBytes: number;
  maxZipEntries: number;
  /** Decompressed volume for the whole batch, all ZIPs together. */
  maxZipExpandedBytes: number;
  maxZipRatio: number;
  maxImageEdge: number;
  maxImageBytes: number;
  maxImagePixels: number;
  maxFileMs: number;
};

// API (Claude, nov-2026): ≤600 images/PDF pages per request, >20 images ⇒ ≤3000 px per side, ≤10 MB per image
// (5 MB on Bedrock), 128 MB per request; Opus 5.5 reads natively up to 2576 px on the long edge.
// These limits are deliberately lower: the request stays small, cheap and well under every platform limit.
export const DEFAULT_LIMITS: BatchLimits = {
  maxFiles: 40,
  maxPages: 100,
  maxRequestBytes: 32 * 1024 * 1024,
  maxZipEntries: 100,
  maxZipExpandedBytes: 200 * 1024 * 1024,
  maxZipRatio: 200,
  maxImageEdge: 2576,
  maxImageBytes: Math.floor(3.7 * 1024 * 1024),
  maxImagePixels: 60_000_000,
  maxFileMs: 30_000,
};

export type TooLarge = { status: "too_large"; limit: "files" | "pages" | "bytes"; max: number; actual: number; reasonEs: string };
export type PrepareResult =
  | { status: "ok"; batch: PreparedBatch }
  | TooLarge
  | { status: "empty"; reasonEs: string; skipped: { name: string; reasonEs: string }[] };

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

export function sniffType(b: Uint8Array): DetectedType {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length < 8) return "unknown";
  const head = ascii(0, Math.min(b.length, 1024));
  if (head.startsWith("%PDF-")) return "pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (ascii(0, 4) === "GIF8") return "gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)) return "tiff";
  if (ascii(4, 8) === "ftyp") {
    const brands = [ascii(8, 12)];
    const boxSize = (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3];
    for (let i = 16; i + 4 <= Math.min(boxSize, b.length, 64); i += 4) brands.push(ascii(i, i + 4));
    if (brands.includes("avif") || brands.includes("avis")) return "avif";
    if (brands.some((x) => HEIC_BRANDS.has(x))) return "heic";
    return "unknown";
  }
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return "zip";
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return "office";
  if (head.includes("%PDF-")) return "pdf";
  return "unknown";
}

const UNSUPPORTED_ES: Partial<Record<DetectedType, string>> = {
  office: "documento de Word/Office: hay que pedirlo en PDF o foto",
  unknown: "formato no reconocido",
};

function isMacJunk(path: string): boolean {
  const base = path.split("/").pop() || "";
  return path.startsWith("__MACOSX/") || path.includes("/__MACOSX/") || base === ".DS_Store" || base.startsWith("._") || base === "Thumbs.db";
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

class Timeout extends Error {}
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Timeout()), ms); })]).finally(() => clearTimeout(timer));
}

type RawEntry = { name: string; bytes: Uint8Array };
type ZipBudget = { expanded: number };
// JSZip 3.x keeps each entry's compressed bytes and declared sizes here; we inflate ourselves with a hard output cap.
type ZipEntryData = { compressedSize: number; uncompressedSize: number; compressedContent: Uint8Array; compression: { magic: string } };

async function expandZip(file: RawEntry, limits: BatchLimits, budget: ZipBudget, skipped: PreparedBatch["skipped"]): Promise<RawEntry[] | TooLarge> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file.bytes);
  } catch {
    skipped.push({ name: file.name, reasonEs: "ZIP dañado o protegido" });
    return [];
  }
  const names = Object.keys(zip.files);
  if (names.includes("[Content_Types].xml")) {
    skipped.push({ name: file.name, reasonEs: UNSUPPORTED_ES.office! });
    return [];
  }
  const entries = names.filter((n) => !zip.files[n].dir && !isMacJunk(n)).sort();
  if (entries.length > limits.maxZipEntries) {
    return { status: "too_large", limit: "files", max: limits.maxZipEntries, actual: entries.length, reasonEs: `El ZIP «${file.name}» trae ${entries.length} archivos y se abren como máximo ${limits.maxZipEntries}.` };
  }
  const data = new Map<string, ZipEntryData>();
  let declared = 0;
  for (const n of entries) {
    const d = (zip.files[n] as unknown as { _data?: ZipEntryData })._data;
    if (!d || !(d.compressedContent instanceof Uint8Array) || typeof d.uncompressedSize !== "number") {
      skipped.push({ name: file.name, reasonEs: "ZIP con un formato que no se puede abrir con seguridad" });
      return [];
    }
    if (d.uncompressedSize / Math.max(1, d.compressedSize) > limits.maxZipRatio) {
      return { status: "too_large", limit: "bytes", max: limits.maxZipExpandedBytes, actual: d.uncompressedSize, reasonEs: `El ZIP «${file.name}» tiene una compresión anómala (posible bomba ZIP): no se abre.` };
    }
    declared += d.uncompressedSize;
    data.set(n, d);
  }
  const tooBig = (actual: number): TooLarge => ({ status: "too_large", limit: "bytes", max: limits.maxZipExpandedBytes, actual, reasonEs: `Los ZIP descomprimidos superan ${mb(limits.maxZipExpandedBytes)} por lote.` });
  if (budget.expanded + declared > limits.maxZipExpandedBytes) return tooBig(budget.expanded + declared);
  const out: RawEntry[] = [];
  for (const n of entries) {
    const d = data.get(n)!;
    const room = limits.maxZipExpandedBytes - budget.expanded;
    let bytes: Uint8Array;
    if (d.compression.magic === "\x00\x00") {
      if (d.compressedContent.length > room) return tooBig(budget.expanded + d.compressedContent.length);
      bytes = d.compressedContent;
    } else if (d.compression.magic === "\x08\x00") {
      try {
        // The header may lie: the real output is cut at the remaining room of the batch.
        bytes = new Uint8Array(inflateRawSync(d.compressedContent, { maxOutputLength: Math.max(1, room) }));
      } catch (err) {
        if ((err as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") return tooBig(limits.maxZipExpandedBytes + 1);
        skipped.push({ name: `${file.name} › ${n}`, reasonEs: "entrada del ZIP dañada" });
        continue;
      }
    } else {
      skipped.push({ name: `${file.name} › ${n}`, reasonEs: "entrada del ZIP con compresión no admitida" });
      continue;
    }
    budget.expanded += bytes.length;
    const name = `${file.name} › ${n}`;
    if (sniffType(bytes) === "zip") {
      skipped.push({ name, reasonEs: "ZIP dentro de otro ZIP: no se abre" });
      continue;
    }
    out.push({ name, bytes });
  }
  return out;
}

async function encodeJpeg(input: sharp.Sharp, limits: BatchLimits): Promise<Buffer> {
  let last: Buffer | null = null;
  for (const quality of [85, 75, 65, 50, 40]) {
    last = await input.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
    if (last.length <= limits.maxImageBytes) return last;
  }
  return last!;
}

type ImageOut = { bytes: Uint8Array; mediaType: "image/jpeg" | "image/png"; conversion: string | null };
type Probe =
  | { kind: "pdf"; pageCount: number; encrypted: boolean }
  | { kind: "image"; input: Uint8Array; meta: sharp.Metadata; frames: number; notes: string[] };

class TooManyPixels extends Error {}

async function probe(u: { bytes: Uint8Array; type: DetectedType }, limits: BatchLimits): Promise<Probe | null> {
  if (u.type === "pdf") {
    let pageCount = 0;
    let encrypted = false;
    try {
      const doc = await PDFDocument.load(u.bytes, { ignoreEncryption: true, updateMetadata: false });
      encrypted = doc.isEncrypted;
      pageCount = doc.getPageCount();
    } catch {
      pageCount = 0;
    }
    // pdf-lib cannot walk some owner-encrypted files; pdf.js opens them (it decrypts with the empty user password).
    if (pageCount < 1) pageCount = (await extractPageTexts(u.bytes, 1))?.numPages ?? 0;
    return pageCount > 0 ? { kind: "pdf", pageCount, encrypted } : null;
  }
  const notes: string[] = [];
  let input = u.bytes;
  if (u.type === "heic") {
    input = new Uint8Array(await heicConvert({ buffer: u.bytes, format: "JPEG", quality: 0.92 }));
    notes.push("HEIC → JPEG");
  }
  const meta = await sharp(input, { failOn: "none", limitInputPixels: false }).metadata();
  const frames = u.type === "tiff" ? Math.max(1, meta.pages || 1) : 1;
  const height = (frames > 1 ? meta.pageHeight : meta.height) || 0;
  if ((meta.width || 0) * height > limits.maxImagePixels) throw new TooManyPixels();
  return { kind: "image", input, meta, frames, notes };
}

async function normalizeImage(p: Extract<Probe, { kind: "image" }>, type: DetectedType, limits: BatchLimits): Promise<ImageOut[]> {
  const { input, meta, frames, notes } = p;
  const out: ImageOut[] = [];
  for (let page = 0; page < frames; page++) {
    const width = meta.width || 0;
    const height = (meta.pageHeight && frames > 1 ? meta.pageHeight : meta.height) || 0;
    const edge = Math.max(width, height);
    const rotated = meta.orientation !== undefined && meta.orientation !== 1;
    const passthrough = (type === "jpeg" || type === "png") && edge <= limits.maxImageEdge && input.length <= limits.maxImageBytes && !rotated;
    if (passthrough) {
      out.push({ bytes: input, mediaType: type === "png" ? "image/png" : "image/jpeg", conversion: null });
      continue;
    }
    const pipeline = sharp(input, { failOn: "none", page, animated: false, limitInputPixels: limits.maxImagePixels })
      .rotate()
      .resize({ width: limits.maxImageEdge, height: limits.maxImageEdge, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" });
    const jpeg = await encodeJpeg(pipeline, limits);
    const pageNotes = [...notes];
    if (type !== "jpeg" && type !== "heic") pageNotes.push(`${type.toUpperCase()} → JPEG`);
    if (edge > limits.maxImageEdge) pageNotes.push(`reducida de ${edge} px a ${limits.maxImageEdge} px`);
    if (rotated) pageNotes.push("enderezada según EXIF");
    out.push({ bytes: new Uint8Array(jpeg), mediaType: "image/jpeg", conversion: pageNotes.join(", ") || "recomprimida" });
  }
  return out;
}

async function extractPageTexts(bytes: Uint8Array, max = 0): Promise<{ texts: string[]; numPages: number } | null> {
  const pages: string[] = [];
  try {
    // pdf.js 1.10 reads `.buffer` and ignores byteOffset: small Buffers live in Node's shared pool, so hand it its own ArrayBuffer.
    const own = Buffer.from(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    const parsed = await pdfParse(own, {
      max,
      pagerender: async (page) => {
        const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
        let text = "";
        let lastY: number | undefined;
        let lastEnd = 0;
        for (const item of content.items) {
          const [a, b, , , x, y] = item.transform;
          if (lastY === undefined) text += item.str;
          else if (Math.abs(lastY - y) < 0.5) text += (x - lastEnd > (Math.hypot(a, b) || 10) * 0.15 ? " " : "") + item.str;
          else text += "\n" + item.str;
          lastY = y;
          lastEnd = x + (item.width || 0);
        }
        pages.push(text);
        return text;
      },
    });
    return { texts: pages, numPages: Number(parsed.numpages) || 0 };
  } catch {
    return null;
  }
}

export async function prepareBatch(input: readonly SourceFile[], limits: BatchLimits = DEFAULT_LIMITS): Promise<PrepareResult> {
  const skipped: PreparedBatch["skipped"] = [];
  const raw: RawEntry[] = [];
  const budget: ZipBudget = { expanded: 0 };
  for (const f of input) {
    const bytes = f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes);
    if (sniffType(bytes) !== "zip") {
      raw.push({ name: f.name, bytes });
      continue;
    }
    const expanded = await expandZip({ name: f.name, bytes }, limits, budget, skipped);
    if (!Array.isArray(expanded)) return expanded;
    raw.push(...expanded);
  }

  const duplicateFiles: PreparedBatch["duplicateFiles"] = [];
  const unique: (RawEntry & { sha256: string; type: DetectedType })[] = [];
  const seen = new Map<string, number>();
  for (const r of raw) {
    const type = sniffType(r.bytes);
    if (UNSUPPORTED_ES[type]) {
      skipped.push({ name: r.name, reasonEs: UNSUPPORTED_ES[type]! });
      continue;
    }
    const sha256 = sha256Hex(r.bytes);
    const first = seen.get(sha256);
    if (first !== undefined) {
      duplicateFiles.push({ name: r.name, sha256, exactDuplicateOf: first });
      continue;
    }
    unique.push({ ...r, sha256, type });
    seen.set(sha256, unique.length);
  }
  if (unique.length > limits.maxFiles) {
    return { status: "too_large", limit: "files", max: limits.maxFiles, actual: unique.length, reasonEs: `Son ${unique.length} archivos y se leen como máximo ${limits.maxFiles} de una vez.` };
  }

  // Cheap pass first (page counts, image headers): the batch limits apply before any conversion or text extraction.
  const probed: { u: (typeof unique)[number]; p: Probe }[] = [];
  let pageTotal = 0;
  let fileTotal = 0;
  for (const u of unique) {
    let p: Probe | null;
    try {
      p = await withTimeout(probe(u, limits), limits.maxFileMs);
    } catch (err) {
      const reasonEs = err instanceof TooManyPixels ? `imagen demasiado grande (más de ${limits.maxImagePixels / 1e6} megapíxeles)` : err instanceof Timeout ? "tiempo de lectura agotado" : "imagen dañada: no se puede abrir";
      skipped.push({ name: u.name, reasonEs });
      continue;
    }
    if (!p) {
      skipped.push({ name: u.name, reasonEs: "PDF dañado, sin páginas o protegido con contraseña de apertura" });
      continue;
    }
    pageTotal += p.kind === "pdf" ? p.pageCount : p.frames;
    fileTotal += p.kind === "pdf" ? 1 : p.frames;
    if (fileTotal > limits.maxFiles) {
      return { status: "too_large", limit: "files", max: limits.maxFiles, actual: fileTotal, reasonEs: `Son más de ${limits.maxFiles} archivos (contando las hojas de los TIFF): se leen como máximo ${limits.maxFiles} de una vez.` };
    }
    if (pageTotal > limits.maxPages) {
      return { status: "too_large", limit: "pages", max: limits.maxPages, actual: pageTotal, reasonEs: `El lote tiene más de ${limits.maxPages} páginas (al menos ${pageTotal}): se leen como máximo ${limits.maxPages} de una vez.` };
    }
    probed.push({ u, p });
  }

  const files: PreparedFile[] = [];
  const indexBySha = new Map<string, number>();
  for (const { u, p } of probed) {
    if (p.kind === "pdf") {
      const extracted = await withTimeout(extractPageTexts(u.bytes), limits.maxFileMs).catch(() => null);
      const pageTexts = extracted && extracted.texts.length === p.pageCount ? extracted.texts : null;
      files.push({
        index: files.length + 1, name: u.name, sha256: u.sha256, detected: "pdf", kind: "pdf", mediaType: "application/pdf",
        bytes: u.bytes, pageCount: p.pageCount, conversion: null, encrypted: p.encrypted,
        textLayer: pageTexts ? isReliableTextLayer(pageTexts.map(countWords)) : false,
        pageTexts,
      });
      indexBySha.set(u.sha256, files.length);
      continue;
    }
    let images: ImageOut[];
    try {
      images = await withTimeout(normalizeImage(p, u.type, limits), limits.maxFileMs);
    } catch (err) {
      skipped.push({ name: u.name, reasonEs: err instanceof Timeout ? "tiempo de lectura agotado" : "imagen dañada: no se puede abrir" });
      continue;
    }
    images.forEach((img, i) => {
      files.push({
        index: files.length + 1, name: images.length > 1 ? `${u.name} (hoja ${i + 1})` : u.name, sha256: u.sha256, detected: u.type,
        kind: "image", mediaType: img.mediaType, bytes: img.bytes, pageCount: 1, conversion: img.conversion, encrypted: false, textLayer: false, pageTexts: null,
      });
      if (i === 0) indexBySha.set(u.sha256, files.length);
    });
  }
  for (const d of duplicateFiles) {
    const original = unique[d.exactDuplicateOf - 1];
    d.exactDuplicateOf = indexBySha.get(original.sha256) ?? 0;
  }
  const dropped = duplicateFiles.filter((d) => d.exactDuplicateOf === 0);
  const keptDuplicates = duplicateFiles.filter((d) => d.exactDuplicateOf !== 0);
  for (const d of dropped) skipped.push({ name: d.name, reasonEs: "copia exacta de un archivo que no se pudo leer" });

  if (files.length === 0) return { status: "empty", reasonEs: "No hay ningún archivo legible en el lote.", skipped };
  const pages: PageRef[] = files.flatMap((f) => Array.from({ length: f.pageCount }, (_, i) => ({ fileIndex: f.index, page: i + 1 })));
  const requestBytes = files.reduce((s, f) => s + f.bytes.length, 0);
  if (requestBytes > limits.maxRequestBytes) {
    return { status: "too_large", limit: "bytes", max: limits.maxRequestBytes, actual: requestBytes, reasonEs: `Los archivos suman ${mb(requestBytes)} y el máximo por lectura es ${mb(limits.maxRequestBytes)}.` };
  }
  return { status: "ok", batch: { files, duplicateFiles: keptDuplicates, skipped, pages, requestBytes } };
}
