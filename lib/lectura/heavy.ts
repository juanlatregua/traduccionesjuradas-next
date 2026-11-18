import { Worker } from "node:worker_threads";

// All heavy or synchronous work on client bytes (inflate, pdf.js, pdf-lib, heic-convert, sharp) runs in a worker thread
// with a V8 memory cap; a deadline is enforced by TERMINATING the worker, which also stops synchronous loops.
// The worker source is a plain JS string (no bundler can rewrite it) and loads its modules with createRequire(cwd).
// Native memory used by libvips (sharp) is outside the V8 cap: the pixel limit protects that side.

const WORKER_SOURCE = String.raw`
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
const tasks = {
  spin: async ({ ms }) => { const end = Date.now() + ms; while (Date.now() < end) {} return { done: true }; },
  allocate: async ({ mb }) => { const keep = []; for (let i = 0; i < mb; i++) keep.push(new Array(131072).fill(i)); return { n: keep.length }; },
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

export class WorkerTimeout extends Error {}
export class WorkerDied extends Error {}
export class WorkerTaskError extends Error {}

export type HeavyLimits = { memoryMb: number; timeoutMs: number };
export const DEFAULT_HEAVY: HeavyLimits = { memoryMb: 768, timeoutMs: 30_000 };

/** One worker, one task at a time; a timed-out or crashed worker is discarded and replaced on the next task. */
export class HeavyWorker {
  private worker: Worker | null = null;
  private seq = 0;
  private chain: Promise<unknown> = Promise.resolve();
  private limits: HeavyLimits;
  constructor(limits: HeavyLimits = DEFAULT_HEAVY) {
    this.limits = limits;
  }

  private spawn(): Worker {
    const w = new Worker(WORKER_SOURCE, {
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

  private exec<T>(task: string, args: Record<string, unknown>, timeoutMs: number): Promise<T> {
    const w = (this.worker ??= this.spawn());
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      const done = (fn: () => void) => {
        clearTimeout(timer);
        w.off("message", onMessage);
        w.off("error", onError);
        w.off("exit", onExit);
        fn();
      };
      const kill = () => {
        if (this.worker === w) this.worker = null;
        void w.terminate();
      };
      const timer = setTimeout(() => done(() => { kill(); reject(new WorkerTimeout(`${task}: más de ${timeoutMs} ms`)); }), timeoutMs);
      const onMessage = (m: { id: number; ok: boolean; result?: T; error?: { name: string; message: string } }) => {
        if (m.id !== id) return;
        done(() => (m.ok ? resolve(m.result as T) : reject(new WorkerTaskError(m.error?.message ?? "error"))));
      };
      const onError = (err: Error) => done(() => { kill(); reject(new WorkerDied(err.message)); });
      const onExit = (code: number) => done(() => { if (this.worker === w) this.worker = null; reject(new WorkerDied(`salió con código ${code}`)); });
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
