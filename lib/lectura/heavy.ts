import { Worker } from "node:worker_threads";
import { INSPECT_SOURCE } from "./inspect-source.ts";

// All work on client bytes beyond magic bytes and sizes (ZIP directory, HEIF headers, inflate, pdf.js, pdf-lib,
// heic-convert, sharp) runs in a worker thread with a V8 memory cap; a deadline is enforced by TERMINATING the worker,
// which also stops synchronous loops. Memory outside V8 (Uint8Array backing stores, wasm, libvips) escapes that cap:
// while a task runs, the main thread watches the ABSOLUTE RSS of the process and terminates the worker above a ceiling
// derived from the function's memory, which is what actually brings the function down. A task does not start while
// the process is above the ceiling (it waits, then fails as HeavyBusy: retryable, the instance is full). A killed
// worker is awaited before its slot is reused. With two slots, a task that pushes the process over the ceiling also
// costs the task running beside it. The worker source is a plain JS string (no bundler can rewrite it) and loads its
// modules with createRequire(cwd).

export function workerSource(extraTasks = ""): string {
  return String.raw`
const { parentPort } = require("node:worker_threads");
const zlib = require("node:zlib");
const req = require("node:module").createRequire(process.cwd() + "/");
let pdfLib, sharp, heic, pdfParse;
const lib = {
  pdfLib: () => (pdfLib ??= req("pdf-lib")),
  sharp: () => (sharp ??= req("sharp")),
  heic: () => (heic ??= req("heic-convert")),
  // pdf-parse's own entry (not its index, which reads a test file when loaded); it drives pdf.js 1.10.
  pdfParse: () => (pdfParse ??= req("pdf-parse/lib/pdf-parse.js")),
};
${INSPECT_SOURCE}
// pdf.js 1.10 misreads a Node Buffer (offsets go wrong: "Invalid PDF structure"); a plain Uint8Array copy reads fine.
const own = (bytes) => new Uint8Array(bytes);
async function pageText(page) {
  const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
  let text = "", lastY, lastEnd = 0;
  for (const item of content.items) {
    const [a, b, , , x, y] = item.transform;
    if (lastY === undefined) text += item.str;
    else if (Math.abs(lastY - y) < 0.5) text += (x - lastEnd > (Math.hypot(a, b) || 10) * 0.15 ? " " : "") + item.str;
    else text += "\n" + item.str;
    lastY = y;
    lastEnd = x + (item.width || 0);
  }
  return text;
}
function contentLength(page) {
  const { PDFArray, PDFRef, PDFRawStream } = lib.pdfLib();
  const contents = page.node.Contents();
  if (!contents) return 0;
  const items = contents instanceof PDFArray ? contents.asArray() : [contents];
  let total = 0;
  for (const item of items) {
    const stream = item instanceof PDFRef ? page.doc.context.lookup(item) : item;
    if (stream instanceof PDFRawStream) total += stream.contents.length;
    else if (stream && typeof stream.getContentsSize === "function") total += stream.getContentsSize();
  }
  return total;
}
const A4 = { w: 595.28, h: 841.89 };
async function assembleOne(PDFDocument, files, loaded, parts) {
  const out = await PDFDocument.create();
  const expect = [];
  for (const part of parts) {
    const file = files.get(part.fileIndex);
    if (file.kind === "pdf") {
      const src = loaded.get(file.index);
      if (!src) return { ok: false, reasonEs: "el archivo " + file.index + " no se puede abrir para montar el documento" };
      if (src.getPageCount() !== file.pageCount) return { ok: false, reasonEs: "el archivo " + file.index + " no tiene las páginas contadas al prepararlo" };
      const [page] = await out.copyPages(src, [part.page - 1]);
      out.addPage(page);
      expect.push(contentLength(src.getPage(part.page - 1)) > 0);
      continue;
    }
    const image = file.mediaType === "image/png" ? await out.embedPng(file.bytes) : await out.embedJpg(file.bytes);
    const page = out.addPage(image.width > image.height ? [A4.h, A4.w] : [A4.w, A4.h]);
    const { width, height } = page.getSize();
    const scale = Math.min(width / image.width, height / image.height);
    const w = image.width * scale, h = image.height * scale;
    page.drawImage(image, { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h });
    expect.push(true);
  }
  const bytes = await out.save();
  const check = await PDFDocument.load(bytes);
  if (check.getPageCount() !== parts.length) return { ok: false, reasonEs: "se esperaban " + parts.length + " páginas y salieron " + check.getPageCount() };
  const blank = check.getPages().findIndex((p, i) => expect[i] && contentLength(p) === 0);
  if (blank >= 0) return { ok: false, reasonEs: "la página " + (blank + 1) + " del montaje ha salido vacía y su original no lo estaba" };
  return { ok: true, bytes, pageCount: parts.length };
}
const tasks = {
  ${extraTasks}
  heifPixels: async ({ bytes }) => ({ pixels: heifPixels(bytes) }),
  zipList: async ({ bytes }) => ({ entries: listZip(bytes) }),
  inflate: async ({ bytes, max }) => {
    try { const out = zlib.inflateRawSync(bytes, { maxOutputLength: Math.max(1, max) }); return { bytes: new Uint8Array(out) }; }
    catch (e) { if (e && e.code === "ERR_BUFFER_TOO_LARGE") return { tooLarge: true }; return { broken: true }; }
  },
  pdfProbe: async ({ bytes, pdfjsMaxBytes }) => {
    let pages = 0, encrypted = false;
    try {
      const doc = await lib.pdfLib().PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      encrypted = doc.isEncrypted;
      pages = doc.getPageCount();
    } catch { pages = 0; }
    if (!encrypted && pages > 0) return { pages, encrypted, openPassword: false, checked: true };
    if (bytes.length > pdfjsMaxBytes) return { pages, encrypted, openPassword: false, checked: false };
    try {
      const r = await lib.pdfParse()(own(bytes), { max: 1, pagerender: async () => "" });
      return { pages: Number(r.numpages) || 0, encrypted, openPassword: false, checked: true };
    } catch (e) {
      return { pages: 0, encrypted, openPassword: !!e && e.name === "PasswordException", checked: true };
    }
  },
  pdfText: async ({ bytes }) => {
    const texts = [];
    const r = await lib.pdfParse()(own(bytes), { pagerender: async (page) => { const t = await pageText(page); texts.push(t); return t; } });
    return { texts, numPages: Number(r.numpages) || 0 };
  },
  heic: async ({ bytes }) => ({ bytes: new Uint8Array(await lib.heic()({ buffer: bytes, format: "JPEG", quality: 0.92 })) }),
  imageMeta: async ({ bytes }) => {
    const m = await lib.sharp()(bytes, { failOn: "none", limitInputPixels: false }).metadata();
    return { width: m.width || 0, height: m.height || 0, pageHeight: m.pageHeight || 0, pages: m.pages || 1, orientation: m.orientation || 1 };
  },
  image: async ({ bytes, page, maxEdge, maxBytes, maxPixels }) => {
    const s = lib.sharp();
    const base = s(bytes, { failOn: "truncated", page, animated: false, limitInputPixels: maxPixels })
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" });
    let out;
    for (const quality of [85, 75, 65, 50, 40]) {
      out = await base.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
      if (out.length <= maxBytes) break;
    }
    return { bytes: new Uint8Array(out) };
  },
  assemble: async ({ files, documents }) => {
    const { PDFDocument } = lib.pdfLib();
    const byIndex = new Map(files.map((f) => [f.index, f]));
    const loaded = new Map();
    for (const f of files) {
      if (f.kind !== "pdf") continue;
      try { loaded.set(f.index, await PDFDocument.load(f.bytes, { updateMetadata: false })); } catch { loaded.set(f.index, null); }
    }
    const results = [];
    for (const parts of documents) {
      try { results.push(await assembleOne(PDFDocument, byIndex, loaded, parts)); }
      catch { results.push({ ok: false, reasonEs: "el documento no se ha podido montar" }); }
    }
    return { results };
  },
};
parentPort.on("message", async ({ id, task, args }) => {
  try {
    const result = await tasks[task](args);
    parentPort.postMessage({ id, ok: true, result });
  } catch (e) {
    parentPort.postMessage({ id, ok: false, error: { name: (e && e.name) || "Error", message: String((e && e.message) || e) } });
  }
});
`;
}

const PRODUCTION_SOURCE = workerSource();

export class WorkerTimeout extends Error {}
export class WorkerDied extends Error {}
export class WorkerOutOfMemory extends WorkerDied {}
export class WorkerTaskError extends Error {}
/** The process is above the RSS ceiling before the task starts: nothing was tried, the batch can be retried later. */
export class HeavyBusy extends Error {}

const MB = 1024 * 1024;
/**
 * Absolute RSS ceiling of the process: the function's memory (AWS_LAMBDA_FUNCTION_MEMORY_SIZE on Vercel) minus a margin
 * for Next itself; LECTURA_RSS_CEILING_MB overrides it; 1536 MB when neither is known.
 */
export function rssCeilingMb(env: Record<string, string | undefined> = process.env): number {
  const explicit = Number(env.LECTURA_RSS_CEILING_MB);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const fn = Number(env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE);
  if (Number.isFinite(fn) && fn > 0) return Math.max(256, Math.floor(fn - Math.max(256, fn * 0.15)));
  return 1536;
}

/** memoryMb: V8 heap of the worker. rssCeilingMb: absolute RSS of the whole process. settleMs: wait for room before a task. */
export type HeavyLimits = { memoryMb: number; rssCeilingMb: number; timeoutMs: number; settleMs?: number };
export const DEFAULT_HEAVY: HeavyLimits = { memoryMb: 768, rssCeilingMb: rssCeilingMb(), timeoutMs: 30_000 };
export const HEAVY_SLOTS = 2;
const RSS_POLL_MS = 5;
const SETTLE_POLL_MS = 50;
const SETTLE_MS = 5_000;

class Semaphore {
  private free: number;
  private waiting: (() => void)[] = [];
  constructor(n: number) {
    this.free = n;
  }
  async acquire(): Promise<() => void> {
    if (this.free > 0) this.free--;
    else await new Promise<void>((r) => this.waiting.push(r));
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const next = this.waiting.shift();
      if (next) next();
      else this.free++;
    };
  }
}
const slots = new Semaphore(HEAVY_SLOTS);

/** One worker, one task at a time; a timed-out, oversized or crashed worker is discarded and replaced on the next task. */
export class HeavyWorker {
  private worker: Worker | null = null;
  private seq = 0;
  private chain: Promise<unknown> = Promise.resolve();
  private limits: HeavyLimits;
  private source: string;
  constructor(limits: HeavyLimits = DEFAULT_HEAVY, source = PRODUCTION_SOURCE) {
    this.limits = limits;
    this.source = source;
  }

  private spawn(): Worker {
    const w = new Worker(this.source, {
      eval: true,
      resourceLimits: { maxOldGenerationSizeMb: this.limits.memoryMb, maxYoungGenerationSizeMb: 64 },
    });
    w.unref();
    return w;
  }

  run<T>(task: string, args: Record<string, unknown>, timeoutMs = this.limits.timeoutMs): Promise<T> {
    const next = this.chain.then(() => this.exec<T>(task, args, timeoutMs));
    this.chain = next.catch(() => undefined);
    return next;
  }

  private async exec<T>(task: string, args: Record<string, unknown>, timeoutMs: number): Promise<T> {
    const release = await slots.acquire();
    const ceiling = this.limits.rssCeilingMb * MB;
    // Memory of a worker just killed (or of other requests) can take a moment to go back: wait instead of starting over the ceiling.
    for (let waited = 0; process.memoryUsage.rss() > ceiling; waited += SETTLE_POLL_MS) {
      if (waited >= (this.limits.settleMs ?? SETTLE_MS)) {
        release();
        throw new HeavyBusy(`${task}: el proceso está por encima de ${this.limits.rssCeilingMb} MB`);
      }
      await new Promise((r) => setTimeout(r, SETTLE_POLL_MS));
    }
    let w: Worker;
    try {
      w = this.worker ??= this.spawn();
    } catch (err) {
      release();
      throw err;
    }
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const done = (outcome: () => void, kill: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearInterval(watch);
        w.off("message", onMessage);
        w.off("error", onError);
        w.off("exit", onExit);
        if (this.worker === w && kill) this.worker = null;
        // The slot is only given back once the killed worker's memory is gone.
        const gone = kill ? w.terminate().then(() => undefined, () => undefined) : Promise.resolve();
        void gone.then(() => {
          release();
          outcome();
        });
      };
      const timer = setTimeout(() => done(() => reject(new WorkerTimeout(`${task}: más de ${timeoutMs} ms`)), true), timeoutMs);
      const watch = setInterval(() => {
        if (process.memoryUsage.rss() > ceiling) done(() => reject(new WorkerOutOfMemory(`${task}: el proceso pasa de ${this.limits.rssCeilingMb} MB`)), true);
      }, RSS_POLL_MS);
      const onMessage = (m: { id: number; ok: boolean; result?: T; error?: { name: string; message: string } }) => {
        if (m.id !== id) return;
        done(() => (m.ok ? resolve(m.result as T) : reject(new WorkerTaskError(m.error?.message ?? "error"))), false);
      };
      const onError = (err: Error) => done(() => reject(new WorkerDied(err.message)), true);
      const onExit = (code: number) => done(() => reject(new WorkerDied(`salió con código ${code}`)), true);
      w.on("message", onMessage);
      w.on("error", onError);
      w.on("exit", onExit);
      w.postMessage({ id, task, args });
    });
  }

  async close(): Promise<void> {
    const w = this.worker;
    this.worker = null;
    if (w) await w.terminate();
  }
}
