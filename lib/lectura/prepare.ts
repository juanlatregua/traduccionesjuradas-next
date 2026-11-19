import { createHash } from "node:crypto";
import { countWords, isReliableTextLayer } from "./words.ts";
import { listZip } from "./zip.ts";
import { HeavyWorker, WorkerDied, WorkerTimeout } from "./heavy.ts";

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
  /** Growth of the process RSS over its base allowed while heavy work runs (covers memory outside V8: buffers, wasm, libvips). */
  workerRssMb: number;
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
  workerRssMb: 1024,
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

class Bits {
  private pos = 0;
  private b: Uint8Array;
  constructor(b: Uint8Array) {
    this.b = b;
  }
  u(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = this.b[this.pos >> 3];
      if (byte === undefined) throw new RangeError("fin de datos");
      v = v * 2 + ((byte >> (7 - (this.pos & 7))) & 1);
      this.pos++;
    }
    return v;
  }
  ue(): number {
    let zeros = 0;
    while (this.u(1) === 0) if (++zeros > 31) throw new RangeError("ue demasiado largo");
    return 2 ** zeros - 1 + this.u(zeros);
  }
}

/** Coded size of an HEVC sequence parameter set (NAL header included). */
function hevcSpsPixels(nal: Uint8Array): number {
  const rbsp: number[] = [];
  for (let i = 2; i < nal.length; i++) {
    if (i >= 4 && nal[i] === 3 && nal[i - 1] === 0 && nal[i - 2] === 0) continue;
    rbsp.push(nal[i]);
  }
  const r = new Bits(Uint8Array.from(rbsp));
  r.u(4);
  const maxSub = r.u(3);
  r.u(1);
  r.u(96);
  const present: [number, number][] = [];
  for (let i = 0; i < maxSub; i++) present.push([r.u(1), r.u(1)]);
  if (maxSub > 0) for (let i = maxSub; i < 8; i++) r.u(2);
  for (const [profile, level] of present) {
    if (profile) r.u(88);
    if (level) r.u(8);
  }
  r.ue();
  if (r.ue() === 3) r.u(1);
  return r.ue() * r.ue();
}

/** Max frame size of an AV1 sequence header OBU inside av1C (0 when absent or not parseable here). */
function av1SequencePixels(obus: Uint8Array): number {
  let i = 0;
  while (i < obus.length) {
    const header = obus[i];
    const type = (header >> 3) & 15;
    const ext = (header >> 2) & 1;
    const hasSize = (header >> 1) & 1;
    i += 1 + ext;
    let size = obus.length - i;
    if (hasSize) {
      size = 0;
      for (let k = 0; k < 8; k++) {
        const byte = obus[i++];
        size += (byte & 127) * 2 ** (7 * k);
        if (!(byte & 128)) break;
      }
    }
    if (type === 1) {
      const r = new Bits(obus.subarray(i, i + size));
      r.u(3);
      r.u(1);
      if (r.u(1)) r.u(5);
      else {
        if (r.u(1)) return 0;
        r.u(1);
        const points = r.u(5) + 1;
        for (let p = 0; p < points; p++) {
          r.u(12);
          if (r.u(5) > 7) r.u(1);
        }
      }
      const wb = r.u(4) + 1;
      const hb = r.u(4) + 1;
      return (r.u(wb) + 1) * (r.u(hb) + 1);
    }
    i += size;
  }
  return 0;
}

/**
 * Pixels an HEIF/AVIF will decode to, read before decoding. The `ispe` boxes are only a declaration: the coded size in
 * the HEVC SPS / AV1 sequence header also counts, and a grid multiplies the tile size by the number of coded items.
 * The decoder itself is still bounded by the worker memory watch.
 */
export function heifPixels(b: Uint8Array): number {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  type Box = { type: string; start: number; end: number };
  // Real boxes only (size-delimited), never a byte-by-byte tag search: the work is linear in the file size.
  const children = (from: number, to: number): Box[] => {
    const out: Box[] = [];
    let p = from;
    while (p + 8 <= to) {
      let size = v.getUint32(p);
      let head = 8;
      if (size === 1) {
        if (p + 16 > to) break;
        size = Number(v.getBigUint64(p + 8));
        head = 16;
      } else if (size === 0) size = to - p;
      if (size < head || p + size > to) break;
      out.push({ type: String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]), start: p + head, end: p + size });
      p += size;
    }
    return out;
  };
  const find = (list: Box[], type: string) => list.find((x) => x.type === type);
  const meta = find(children(0, b.length), "meta");
  if (!meta) return 0;
  const inMeta = children(meta.start + 4, meta.end);
  let ispe = 0;
  let coded = 0;
  let grid = false;
  const items = new Map<number, string>();
  const located = new Map<number, [number, number]>();
  const uint = (p: number, n: number) => (n === 0 ? 0 : n === 2 ? v.getUint16(p) : n === 4 ? v.getUint32(p) : Number(v.getBigUint64(p)));
  try {
    const iinf = find(inMeta, "iinf");
    if (iinf) {
      for (const e of children(iinf.start + 4 + (b[iinf.start] === 0 ? 2 : 4), iinf.end)) {
        if (e.type !== "infe" || b[e.start] < 2 || e.end - e.start < 12) continue;
        const wide = b[e.start] !== 2;
        const id = uint(e.start + 4, wide ? 4 : 2);
        const t = e.start + 4 + (wide ? 4 : 2) + 2;
        const type = String.fromCharCode(b[t], b[t + 1], b[t + 2], b[t + 3]);
        items.set(id, type);
        if (type === "grid") grid = true;
      }
    }
  } catch {}
  try {
    const iloc = find(inMeta, "iloc");
    if (iloc) {
      const end = iloc.end;
      const version = b[iloc.start];
      const offSize = b[iloc.start + 4] >> 4, lenSize = b[iloc.start + 4] & 15, baseSize = b[iloc.start + 5] >> 4, idxSize = version >= 1 ? b[iloc.start + 5] & 15 : 0;
      const idSize = version < 2 ? 2 : 4;
      let p = iloc.start + 6;
      const count = uint(p, idSize);
      p += idSize;
      const extentSize = idxSize + offSize + lenSize;
      for (let k = 0; k < count && p < end; k++) {
        const id = uint(p, idSize);
        p += idSize;
        const method = version >= 1 ? v.getUint16(p) & 15 : 0;
        if (version >= 1) p += 2;
        p += 2;
        const base = uint(p, baseSize);
        p += baseSize;
        const extents = v.getUint16(p);
        p += 2;
        if (extents === 0 || extentSize === 0) continue;
        if (p + extents * extentSize > end) break;
        const off = uint(p + idxSize, offSize);
        const len = uint(p + idxSize + offSize, lenSize);
        if (method === 0) located.set(id, [base + off, len]);
        p += extents * extentSize;
      }
    }
  } catch {}
  const ipco = (() => {
    const iprp = find(inMeta, "iprp");
    return iprp ? find(children(iprp.start, iprp.end), "ipco") : undefined;
  })();
  for (const prop of ipco ? children(ipco.start, ipco.end) : []) {
    try {
      if (prop.type === "ispe" && prop.end - prop.start >= 12) ispe = Math.max(ispe, v.getUint32(prop.start + 4) * v.getUint32(prop.start + 8));
      else if (prop.type === "hvcC") {
        let p = prop.start + 22;
        const arrays = b[p++] ?? 0;
        for (let a = 0; a < arrays && p + 3 <= prop.end; a++) {
          const type = b[p] & 63;
          const n = v.getUint16(p + 1);
          p += 3;
          for (let k = 0; k < n && p + 2 <= prop.end; k++) {
            const len = v.getUint16(p);
            p += 2;
            if (type === 33) coded = Math.max(coded, hevcSpsPixels(b.subarray(p, Math.min(prop.end, p + len))));
            p += len;
          }
        }
      } else if (prop.type === "av1C") coded = Math.max(coded, av1SequencePixels(b.subarray(prop.start + 4, prop.end)));
    } catch {}
  }
  let codedItems = 0;
  for (const [id, type] of items) {
    if (type !== "hvc1" && type !== "av01") continue;
    codedItems++;
    const at = located.get(id);
    if (type === "av01" && at && at[0] < b.length) {
      try {
        coded = Math.max(coded, av1SequencePixels(b.subarray(at[0], Math.min(b.length, at[0] + (at[1] || b.length)))));
      } catch {}
    }
  }
  return Math.max(ispe, grid ? coded * Math.max(1, codedItems) : coded);
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

async function expandZip(file: RawEntry, limits: BatchLimits, budget: Budget, heavy: HeavyWorker, skipped: Skip): Promise<RawEntry[] | TooLarge> {
  const entries = listZip(file.bytes);
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
    const px = heifPixels(u.bytes);
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
  if (err instanceof WorkerTimeout) return `${what}: tiempo de lectura agotado`;
  if (err instanceof WorkerDied) return `${what}: se quedó sin memoria al abrirlo`;
  return `${what} dañado: no se puede abrir`;
}

export async function prepareBatch(input: readonly SourceFile[], limits: BatchLimits = DEFAULT_LIMITS): Promise<PrepareResult> {
  const heavy = new HeavyWorker({ memoryMb: limits.workerMemoryMb, rssMb: limits.workerRssMb, timeoutMs: limits.maxFileMs });
  try {
    return await prepareWith(input, limits, heavy);
  } finally {
    await heavy.close();
  }
}

async function prepareWith(input: readonly SourceFile[], limits: BatchLimits, heavy: HeavyWorker): Promise<PrepareResult> {
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
    const expanded = await expandZip({ name: f.name, bytes }, limits, budget, heavy, skipped);
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
  for (const { u, p } of probed) {
    if (p.kind === "pdf") {
      let pageTexts: string[] | null = null;
      if (u.bytes.length <= limits.maxPdfjsBytes) {
        const t = await heavy.run<{ texts: string[]; numPages: number }>("pdfText", { bytes: u.bytes }, limits.maxFileMs).catch(() => null);
        if (t && t.numPages !== p.pageCount) {
          skipped.push({ name: u.name, reasonEs: `PDF con un recuento de páginas dudoso (${p.pageCount} o ${t.numPages} según cómo se lea): hay que pedirlo de nuevo` });
          continue;
        }
        if (t && t.texts.length === p.pageCount) pageTexts = t.texts;
      }
      files.push({
        index: files.length + 1, name: u.name, sha256: u.sha256, detected: "pdf", kind: "pdf", mediaType: "application/pdf",
        bytes: u.bytes, pageCount: p.pageCount, conversion: null, encrypted: p.encrypted,
        textLayer: pageTexts ? isReliableTextLayer(pageTexts.map(countWords)) : false,
        pageTexts,
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
      skipped.push({ name: u.name, reasonEs: heavyReason(err, "imagen") });
      continue;
    }
    const notes = [...p.notes, ...(p.edge > limits.maxImageEdge ? [`reducida de ${p.edge} px a ${limits.maxImageEdge} px`] : [])];
    images.forEach((img, i) => {
      files.push({
        index: files.length + 1, name: images.length > 1 ? `${u.name} (hoja ${i + 1})` : u.name, sha256: u.sha256, detected: u.type,
        kind: "image", mediaType: "image/jpeg", bytes: img, pageCount: 1, conversion: notes.join(", ") || "recomprimida", encrypted: false, textLayer: false, pageTexts: null,
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
