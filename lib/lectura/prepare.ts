import { createHash } from "node:crypto";
import { HeavyBusy, HeavyWorker, rssCeilingMb, WorkerDied, WorkerTimeout } from "./heavy.ts";

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
  /** Why a PDF's text is not used (too long for its size, bomb-like), null when it is or there was none. */
  textNote: string | null;
  /** Text per page (index 0 = page 1) when the PDF has a text layer at all. */
  pageTexts: string[] | null;
  /** Words per page counted in the worker (index 0 = page 1), alongside pageTexts. */
  pageWords: number[] | null;
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
  /** Decompressed size of one ZIP entry: nothing bigger can be sent anyway. */
  maxZipEntryBytes: number;
  /** Decompressed volume for the whole batch, all ZIPs together. */
  maxZipExpandedBytes: number;
  maxZipRatio: number;
  /** pdf.js (fallback page count, password check, text layer) only up to this size: it keeps ~40× the file in memory. */
  maxPdfjsBytes: number;
  maxImageEdge: number;
  maxImageBytes: number;
  maxImagePixels: number;
  maxFileMs: number;
  workerMemoryMb: number;
  /** Text kept from a PDF page / from the whole batch: beyond it the text layer is not used at all. */
  maxPageTextChars: number;
  maxTextChars: number;
  /** Absolute RSS ceiling of the process while heavy work runs (covers memory outside V8: buffers, wasm, libvips). */
  rssCeilingMb: number;
};

// API (Claude, nov-2026): ≤600 images/PDF pages per request, >20 images ⇒ ≤3000 px per side, ≤10 MB per image
// (5 MB on Bedrock), 128 MB per request; Opus 5.5 reads natively up to 2576 px on the long edge.
// These limits are deliberately lower: the request stays small, cheap and well under every platform limit.
export const DEFAULT_LIMITS: BatchLimits = {
  maxFiles: 40,
  maxPages: 100,
  maxRequestBytes: 32 * 1024 * 1024,
  maxZipEntries: 100,
  maxZipEntryBytes: 32 * 1024 * 1024,
  maxZipExpandedBytes: 64 * 1024 * 1024,
  maxZipRatio: 100,
  maxPdfjsBytes: 10 * 1024 * 1024,
  maxImageEdge: 2576,
  maxImageBytes: Math.floor(3.7 * 1024 * 1024),
  maxImagePixels: 60_000_000,
  maxFileMs: 30_000,
  workerMemoryMb: 768,
  maxPageTextChars: 20_000,
  maxTextChars: 400_000,
  rssCeilingMb: rssCeilingMb(),
};

export type TooLarge = { status: "too_large"; limit: "files" | "pages" | "bytes"; max: number; actual: number; reasonEs: string };
export type PrepareResult =
  | { status: "ok"; batch: PreparedBatch }
  | TooLarge
  | { status: "empty"; reasonEs: string; skipped: { name: string; reasonEs: string }[] }
  | Busy;
/** The instance had no memory room for the heavy work: nothing about the files is known, retry the whole batch later. */
export type Busy = { status: "busy"; retryable: true; attempt: number; maxRetries: number; reasonEs: string };
export const BUSY_ES = "El servidor está ocupado con otros lotes y no ha podido abrir los archivos: vuelve a intentarlo en un minuto.";
/** Retries after a busy result; on the attempt after the last one, a file that still finds no room is skipped instead. */
export const MAX_BUSY_RETRIES = 2;
const BUSY_SKIP_ES = (what: string) => `${what}: el servidor no tuvo memoria libre para abrirlo tras ${MAX_BUSY_RETRIES + 1} intentos`;
/** A module the worker could not load is a deployment fault: the whole reading fails instead of blaming the file. */
export const moduleMissing = (err: unknown) => /Cannot find module|MODULE_NOT_FOUND/.test(err instanceof Error ? `${err.message} ${(err as { code?: string }).code ?? ""}` : String(err));

const rethrowBusy = (err: unknown, final: boolean) => {
  if (moduleMissing(err)) throw err;
  if (err instanceof HeavyBusy && !final) throw err;
};

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
  return path.startsWith("__MACOSX/") || path.includes("/__MACOSX/") || base === ".DS_Store" || base.startsWith("._") || base === "Thumbs.db" || base === "Icon\r";
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

type RawEntry = { name: string; bytes: Uint8Array };
type Budget = { expanded: number };
type Skip = PreparedBatch["skipped"];

async function expandZip(file: RawEntry, limits: BatchLimits, budget: Budget, heavy: HeavyWorker, skipped: Skip, final: boolean): Promise<RawEntry[] | TooLarge> {
  type Listed = { name: string; method: number; encrypted: boolean; compressedSize: number; declaredSize: number; start: number };
  let listed: Listed[] | null = null;
  try {
    listed = (await heavy.run<{ entries: Listed[] | null }>("zipList", { bytes: file.bytes }, limits.maxFileMs)).entries;
  } catch (err) {
    rethrowBusy(err, final);
    if (err instanceof HeavyBusy) {
      skipped.push({ name: file.name, reasonEs: BUSY_SKIP_ES("ZIP") });
      return [];
    }
  }
  const entries = listed?.map((e) => ({ ...e, data: file.bytes.subarray(e.start, e.start + e.compressedSize) }));
  if (!entries) {
    skipped.push({ name: file.name, reasonEs: "ZIP dañado o en un formato que no se puede abrir (ZIP64)" });
    return [];
  }
  if (entries.some((e) => e.name === "[Content_Types].xml")) {
    skipped.push({ name: file.name, reasonEs: UNSUPPORTED_ES.office! });
    return [];
  }
  const files = entries.filter((e) => !e.name.endsWith("/") && !isMacJunk(e.name));
  if (files.length > limits.maxZipEntries) {
    return { status: "too_large", limit: "files", max: limits.maxZipEntries, actual: files.length, reasonEs: `El ZIP «${file.name}» trae ${files.length} archivos y se abren como máximo ${limits.maxZipEntries}.` };
  }
  const tooBig = (actual: number): TooLarge => ({ status: "too_large", limit: "bytes", max: limits.maxZipExpandedBytes, actual, reasonEs: `Los ZIP descomprimidos superan ${mb(limits.maxZipExpandedBytes)} por lote.` });
  let declared = 0;
  for (const e of files) {
    if (e.declaredSize / Math.max(1, e.compressedSize) > limits.maxZipRatio) {
      return { status: "too_large", limit: "bytes", max: limits.maxZipExpandedBytes, actual: e.declaredSize, reasonEs: `El ZIP «${file.name}» tiene una compresión anómala (posible bomba ZIP): no se abre.` };
    }
    declared += Math.min(e.declaredSize, limits.maxZipEntryBytes);
  }
  if (budget.expanded + declared > limits.maxZipExpandedBytes) return tooBig(budget.expanded + declared);

  const out: RawEntry[] = [];
  for (const e of files) {
    const name = `${file.name} › ${e.name}`;
    if (e.encrypted) {
      skipped.push({ name, reasonEs: "entrada del ZIP cifrada con contraseña" });
      continue;
    }
    if (e.declaredSize > limits.maxZipEntryBytes) {
      skipped.push({ name, reasonEs: `entrada del ZIP demasiado grande (${mb(e.declaredSize)})` });
      continue;
    }
    const room = Math.min(limits.maxZipEntryBytes, limits.maxZipExpandedBytes - budget.expanded);
    let bytes: Uint8Array;
    if (e.method === 0) {
      if (e.data.length > room) return tooBig(budget.expanded + e.data.length);
      bytes = e.data;
    } else if (e.method === 8) {
      let r: { bytes?: Uint8Array; tooLarge?: boolean; broken?: boolean };
      try {
        // The header may lie: the real output is cut at the room left (per entry and per batch), inside the worker.
        r = await heavy.run("inflate", { bytes: e.data, max: room }, limits.maxFileMs);
      } catch (err) {
        rethrowBusy(err, final);
        skipped.push({ name, reasonEs: err instanceof WorkerTimeout ? "entrada del ZIP: tiempo de descompresión agotado" : "entrada del ZIP: la descompresión se quedó sin memoria" });
        continue;
      }
      if (r.tooLarge) {
        if (room < limits.maxZipEntryBytes) return tooBig(limits.maxZipExpandedBytes + 1);
        skipped.push({ name, reasonEs: `entrada del ZIP de más de ${mb(limits.maxZipEntryBytes)} descomprimida (la cabecera declaraba menos)` });
        continue;
      }
      if (r.broken || !r.bytes) {
        skipped.push({ name, reasonEs: "entrada del ZIP dañada" });
        continue;
      }
      bytes = r.bytes;
    } else {
      skipped.push({ name, reasonEs: `entrada del ZIP con un método de compresión no admitido (${e.method})` });
      continue;
    }
    budget.expanded += bytes.length;
    if (bytes.length === 0) {
      skipped.push({ name, reasonEs: "archivo vacío" });
      continue;
    }
    if (sniffType(bytes) === "zip") {
      skipped.push({ name, reasonEs: "ZIP dentro de otro ZIP: no se abre" });
      continue;
    }
    out.push({ name, bytes });
  }
  return out;
}

type Probe =
  | { kind: "pdf"; pageCount: number; encrypted: boolean }
  | { kind: "image"; input: Uint8Array; frames: number; edge: number; notes: string[] };
class Unreadable extends Error {}

async function probe(u: { name: string; bytes: Uint8Array; type: DetectedType }, limits: BatchLimits, heavy: HeavyWorker): Promise<Probe> {
  if (u.type === "pdf") {
    const r = await heavy.run<{ pages: number; encrypted: boolean; openPassword: boolean; checked: boolean }>("pdfProbe", { bytes: u.bytes, pdfjsMaxBytes: limits.maxPdfjsBytes }, limits.maxFileMs);
    if (r.openPassword) throw new Unreadable("protegido con contraseña de apertura: pide una copia sin proteger");
    if (!r.checked) {
      throw new Unreadable(r.encrypted
        ? `PDF cifrado de más de ${mb(limits.maxPdfjsBytes)}: no se puede comprobar con seguridad si se abre sin contraseña`
        : `PDF dañado de más de ${mb(limits.maxPdfjsBytes)}: no se puede contar sus páginas con seguridad`);
    }
    if (r.pages < 1) throw new Unreadable("PDF dañado o sin páginas: no se puede abrir");
    return { kind: "pdf", pageCount: r.pages, encrypted: r.encrypted };
  }
  const notes: string[] = [];
  let input = u.bytes;
  if (u.type === "heic" || u.type === "avif") {
    const px = (await heavy.run<{ pixels: number }>("heifPixels", { bytes: u.bytes }, limits.maxFileMs)).pixels;
    if (px === 0) throw new Unreadable(`${u.type.toUpperCase()} sin dimensiones legibles: imagen dañada`);
    if (px > limits.maxImagePixels) throw new Unreadable(`imagen demasiado grande (más de ${limits.maxImagePixels / 1e6} megapíxeles)`);
  }
  if (u.type === "heic") {
    input = (await heavy.run<{ bytes: Uint8Array }>("heic", { bytes: u.bytes }, limits.maxFileMs)).bytes;
    notes.push("HEIC → JPEG");
  }
  const m = await heavy.run<{ width: number; height: number; pageHeight: number; pages: number; orientation: number }>("imageMeta", { bytes: input }, limits.maxFileMs);
  const frames = u.type === "tiff" ? Math.max(1, m.pages) : 1;
  const height = frames > 1 && m.pageHeight ? m.pageHeight : m.height;
  if (m.width * height === 0) throw new Unreadable("imagen dañada: no se puede abrir");
  if (m.width * height > limits.maxImagePixels) throw new Unreadable(`imagen demasiado grande (más de ${limits.maxImagePixels / 1e6} megapíxeles)`);
  if (u.type !== "jpeg" && u.type !== "heic") notes.push(`${u.type.toUpperCase()} → JPEG`);
  if (m.orientation !== 1) notes.push("enderezada según EXIF");
  return { kind: "image", input, frames, edge: Math.max(m.width, height), notes };
}

function heavyReason(err: unknown, what: string): string {
  if (err instanceof Unreadable) return err.message;
  if (err instanceof HeavyBusy) return BUSY_SKIP_ES(what);
  if (err instanceof WorkerTimeout) return `${what}: tiempo de lectura agotado`;
  if (err instanceof WorkerDied) return `${what}: se quedó sin memoria al abrirlo`;
  return `${what} dañado: no se puede abrir`;
}

/** attempt: how many busy results this same batch already got (0 the first time). */
export async function prepareBatch(input: readonly SourceFile[], limits: BatchLimits = DEFAULT_LIMITS, attempt = 0): Promise<PrepareResult> {
  const heavy = new HeavyWorker({ memoryMb: limits.workerMemoryMb, rssCeilingMb: limits.rssCeilingMb, timeoutMs: limits.maxFileMs });
  try {
    return await prepareWith(input, limits, heavy, attempt >= MAX_BUSY_RETRIES);
  } catch (err) {
    if (err instanceof HeavyBusy) return { status: "busy", retryable: true, attempt: attempt + 1, maxRetries: MAX_BUSY_RETRIES, reasonEs: BUSY_ES };
    throw err;
  } finally {
    await heavy.close();
  }
}

async function prepareWith(input: readonly SourceFile[], limits: BatchLimits, heavy: HeavyWorker, final: boolean): Promise<PrepareResult> {
  const skipped: Skip = [];
  const raw: RawEntry[] = [];
  const budget: Budget = { expanded: 0 };
  for (const f of input) {
    const bytes = f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes);
    if (bytes.length === 0) {
      skipped.push({ name: f.name, reasonEs: "archivo vacío" });
      continue;
    }
    if (sniffType(bytes) !== "zip") {
      raw.push({ name: f.name, bytes });
      continue;
    }
    const expanded = await expandZip({ name: f.name, bytes }, limits, budget, heavy, skipped, final);
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
    if (r.bytes.length > limits.maxRequestBytes) {
      return { status: "too_large", limit: "bytes", max: limits.maxRequestBytes, actual: r.bytes.length, reasonEs: `«${r.name}» ocupa ${mb(r.bytes.length)} y el máximo por lectura es ${mb(limits.maxRequestBytes)}.` };
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
    let p: Probe;
    try {
      p = await probe(u, limits, heavy);
    } catch (err) {
      rethrowBusy(err, final);
      skipped.push({ name: u.name, reasonEs: heavyReason(err, u.type === "pdf" ? "PDF" : "imagen") });
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
  let textLeft = limits.maxTextChars;
  for (const { u, p } of probed) {
    if (p.kind === "pdf") {
      let text: { texts: string[]; words: number[]; reliable: boolean } | null = null;
      let textNote: string | null = null;
      if (u.bytes.length <= limits.maxPdfjsBytes) {
        type Text = { numPages: number; over: "page" | "file" | null; texts: string[] | null; words: number[] | null; reliable: boolean; chars: number };
        const t = await heavy.run<Text>("pdfText", { bytes: u.bytes, maxPageChars: limits.maxPageTextChars, maxChars: textLeft }, limits.maxFileMs).catch((err) => {
          rethrowBusy(err, final);
          return null;
        });
        if (t && t.numPages !== p.pageCount) {
          skipped.push({ name: u.name, reasonEs: `PDF con un recuento de páginas dudoso (${p.pageCount} o ${t.numPages} según cómo se lea): hay que pedirlo de nuevo` });
          continue;
        }
        if (t?.over) textNote = t.over === "page" ? `una página trae más de ${limits.maxPageTextChars} caracteres de texto: no se usa` : `el texto del lote pasa de ${limits.maxTextChars} caracteres: no se usa`;
        else if (t?.texts && t.words && t.texts.length === p.pageCount) {
          text = { texts: t.texts, words: t.words, reliable: t.reliable };
          textLeft -= t.chars;
        }
      }
      files.push({
        index: files.length + 1, name: u.name, sha256: u.sha256, detected: "pdf", kind: "pdf", mediaType: "application/pdf",
        bytes: u.bytes, pageCount: p.pageCount, conversion: null, encrypted: p.encrypted,
        textLayer: text?.reliable ?? false,
        textNote,
        pageTexts: text?.texts ?? null,
        pageWords: text?.words ?? null,
      });
      indexBySha.set(u.sha256, files.length);
      continue;
    }
    // Every image is decoded for real (inside the worker) before it counts: a broken one never reaches the model.
    const images: Uint8Array[] = [];
    try {
      for (let page = 0; page < p.frames; page++) {
        const r = await heavy.run<{ bytes: Uint8Array }>("image", { bytes: p.input, page, maxEdge: limits.maxImageEdge, maxBytes: limits.maxImageBytes, maxPixels: limits.maxImagePixels }, limits.maxFileMs);
        images.push(r.bytes);
      }
    } catch (err) {
      rethrowBusy(err, final);
      skipped.push({ name: u.name, reasonEs: heavyReason(err, "imagen") });
      continue;
    }
    const notes = [...p.notes, ...(p.edge > limits.maxImageEdge ? [`reducida de ${p.edge} px a ${limits.maxImageEdge} px`] : [])];
    images.forEach((img, i) => {
      files.push({
        index: files.length + 1, name: images.length > 1 ? `${u.name} (hoja ${i + 1})` : u.name, sha256: u.sha256, detected: u.type,
        kind: "image", mediaType: "image/jpeg", bytes: img, pageCount: 1, conversion: notes.join(", ") || "recomprimida", encrypted: false, textLayer: false, textNote: null, pageTexts: null, pageWords: null,
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
