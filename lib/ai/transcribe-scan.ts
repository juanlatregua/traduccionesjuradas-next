// lib/ai/transcribe-scan.ts — Conteo de palabras de PDFs ESCANEADOS transcribiendo
// TODAS las páginas (en vez de extrapolar desde las 3 primeras).
//
// El PDF se parte en tandas de SCAN_BATCH_PAGES páginas; cada tanda se manda a
// Claude como sub-PDF y se le pide la transcripción literal con un marcador
// `=== PÁGINA n ===` por página (n RELATIVO a la tanda: 1..k). Se cuenta con
// billableWordCount por página. Páginas anormalmente bajas se releen solas.

import Anthropic from "@anthropic-ai/sdk";
import { SONNET_MODEL, HAIKU_MODEL, assertNotRefused } from "./models.ts";
import { billableWordCount } from "./word-counter.ts";

// Modelo de transcripción: Haiku por defecto (medido en SEREJSKI: -1,2 % vs -2,2 %
// de Sonnet, ~15x más barato). SCAN_MODEL=sonnet lo vuelve a Sonnet; se lee en ejecución.
export function scanModel(): string {
  return (process.env.SCAN_MODEL || "").trim().toLowerCase() === "sonnet" ? SONNET_MODEL : HAIKU_MODEL;
}
export const SCAN_BATCH_PAGES = 4;
export const SCAN_CONCURRENCY = 6;
export const SCAN_CALL_TIMEOUT_MS = 75_000;
// Presupuesto total de la transcripción (reintentos y relecturas incluidos):
// el análisis paralelo tiene 110 s y las rutas maxDuration 120.
export const SCAN_TOTAL_BUDGET_MS = 95_000;
const SCAN_MAX_TOKENS = 16_000;
const LOW_RATIO = 0.35;
const LOW_MEDIAN_MIN = 120;

// Interruptor de ejecución (no al importar): SCAN_FULL_COUNT=off lo apaga.
export function scanFullCountEnabled(): boolean {
  return (process.env.SCAN_FULL_COUNT || "").trim().toLowerCase() !== "off";
}

export type ScanCallInput = {
  model: string;
  pdfBase64: string;
  pageCount: number; // páginas del sub-PDF
  timeoutMs: number;
  signal?: AbortSignal;
};
export type ScanCallOutput = {
  text: string;
  stopReason: string | null;
  usage: { input: number; output: number };
};
export type ScanDeps = {
  callModel?: (input: ScanCallInput) => Promise<ScanCallOutput>;
  // Trocea el PDF: devuelve el sub-PDF en base64 de las páginas [start,end] (0-based, inclusivo).
  slicePdf?: (start: number, end: number) => Promise<string>;
  now?: () => number;
  // Aborta toda la transcripción (p. ej. si el análisis paralelo falla).
  signal?: AbortSignal;
  // Cuenta las palabras de una página transcrita; por defecto billableWordCount.
  countWords?: (text: string) => number;
};
export type ScanOptions = {
  pageCount: number;
  fileName?: string;
  bilingualDuplicate?: boolean;
  model?: string;
  totalBudgetMs?: number;
};
export type ScanResult = {
  totalWords: number;
  perPage: number[];
  lowPages: number[]; // 1-based: sigue < 35 % de la mediana tras releer (¿página corta de verdad?)
  failedPages: number[]; // 1-based: sin lectura (error/timeout/truncada)
  blockPages: number[]; // 1-based: marcadores no cuadraron; palabras repartidas a partes iguales
  model: string;
  ms: number;
  usage: { input: number; output: number };
};

export function planBatches(pageCount: number, size = SCAN_BATCH_PAGES): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let s = 0; s < pageCount; s += size) out.push([s, Math.min(s + size, pageCount) - 1]);
  return out;
}

const MARKER_RE = /^[ \t]*={3,}[ \t]*P[ÁA]GINA[ \t]+(\d+)[ \t]*={3,}[ \t]*$/gimu;

// Devuelve el texto por página si hay exactamente `expected` marcadores 1..expected
// consecutivos; si no, null.
export function parseMarkedPages(text: string, expected: number): string[] | null {
  const marks: Array<{ n: number; start: number; end: number }> = [];
  for (const m of text.matchAll(MARKER_RE)) {
    marks.push({ n: Number(m[1]), start: m.index!, end: m.index! + m[0].length });
  }
  if (marks.length !== expected) return null;
  for (let i = 0; i < marks.length; i++) if (marks[i].n !== i + 1) return null;
  return marks.map((m, i) => text.slice(m.end, i + 1 < marks.length ? marks[i + 1].start : text.length));
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export const SCAN_PROMPT = (k: number) =>
  `Este PDF tiene ${k} página${k === 1 ? "" : "s"} escaneada${k === 1 ? "" : "s"}. Transcribe LITERALMENTE todo el texto legible de cada página, ` +
  `en su idioma original: incluye encabezados y sellos con texto impreso, notas al margen, números y texto manuscrito legible. ` +
  `No traduzcas, no resumas, no comentes y NO añadas anotaciones como [sello], [firma] o [ilegible]: si algo no se lee, omítelo. ` +
  `No completes palabras ni frases cortadas, no reconstruyas texto que falte y no repitas encabezados o pies que no estén impresos en esa página.\n\n` +
  `Cada página debe empezar con una línea exacta con este formato (numeración 1..${k} dentro de este PDF):\n=== PÁGINA 1 ===\n` +
  `y a continuación el texto de esa página. Devuelve solo las transcripciones, nada más.`;

async function defaultCallModel(input: ScanCallInput): Promise<ScanCallOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada.");
  const client = new Anthropic({ apiKey, maxRetries: 2 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const onAbort = () => controller.abort();
  if (input.signal?.aborted) controller.abort();
  else input.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const resp = await client.messages.create(
      {
        model: input.model,
        max_tokens: SCAN_MAX_TOKENS,
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 } },
              { type: "text", text: SCAN_PROMPT(input.pageCount) },
            ],
          },
        ],
      },
      { signal: controller.signal }
    );
    assertNotRefused(resp, "transcribeScannedPdf");
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return {
      text,
      stopReason: resp.stop_reason ?? null,
      usage: { input: resp.usage?.input_tokens || 0, output: resp.usage?.output_tokens || 0 },
    };
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", onAbort);
  }
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

export async function transcribeScannedPdf(
  buffer: Buffer,
  opts: ScanOptions,
  deps: ScanDeps = {}
): Promise<ScanResult> {
  const now = deps.now ?? Date.now;
  const t0 = now();
  const model = opts.model || scanModel();
  const callModel = deps.callModel ?? defaultCallModel;
  const budget = opts.totalBudgetMs ?? SCAN_TOTAL_BUDGET_MS;
  const n = opts.pageCount;
  const bil = opts.bilingualDuplicate === true;
  const count = deps.countWords ?? ((text: string) => billableWordCount(text, { bilingualDuplicate: bil }));

  let srcPromise: Promise<any> | null = null;
  const slicePdf =
    deps.slicePdf ??
    (async (start: number, end: number) => {
      const { PDFDocument } = await import("pdf-lib");
      srcPromise ??= PDFDocument.load(buffer, { ignoreEncryption: true });
      const src = await srcPromise;
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, Array.from({ length: end - start + 1 }, (_, i) => start + i));
      copied.forEach((p) => out.addPage(p));
      return Buffer.from(await out.save()).toString("base64");
    });

  const perPage: number[] = new Array(n).fill(0);
  const failed = new Set<number>(); // 0-based
  const block = new Set<number>();
  const blockBatches: Array<[number, number]> = [];
  const usage = { input: 0, output: 0 };

  const remaining = () => budget - (now() - t0);

  // Una llamada con UN reintento (si queda presupuesto). Lanza si ambas fallan.
  async function call(start: number, end: number): Promise<ScanCallOutput> {
    if (remaining() < 5_000) throw new Error("presupuesto de tiempo agotado");
    if (deps.signal?.aborted) throw new Error("transcripción abortada");
    const pdfBase64 = await slicePdf(start, end);
    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = remaining();
      if (left < 5_000 || deps.signal?.aborted) break;
      try {
        const out = await callModel({
          model,
          pdfBase64,
          pageCount: end - start + 1,
          timeoutMs: Math.min(SCAN_CALL_TIMEOUT_MS, left),
          signal: deps.signal,
        });
        usage.input += out.usage.input;
        usage.output += out.usage.output;
        return out;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error("presupuesto de tiempo agotado");
  }

  // Lee un rango; devuelve palabras por página (relativas al rango) o lanza.
  // Si se corta por max_tokens parte el rango en páginas sueltas.
  async function readRange(start: number, end: number): Promise<{ words: number[]; block: boolean }> {
    const k = end - start + 1;
    const out = await call(start, end);
    if (out.stopReason === "max_tokens") {
      if (k === 1) throw new Error("página truncada por max_tokens");
      const words: number[] = [];
      let anyBlock = false;
      for (let p = start; p <= end; p++) {
        try {
          const r = await readRange(p, p);
          words.push(r.words[0]);
          if (r.block) anyBlock = true;
        } catch {
          failed.add(p);
          words.push(0);
        }
      }
      return { words, block: anyBlock };
    }
    const pages = parseMarkedPages(out.text, k);
    if (pages) return { words: pages.map(count), block: false };
    // Marcadores que no cuadran: la tanda cuenta como un bloque, repartido a partes iguales.
    const total = count(out.text.replace(MARKER_RE, ""));
    return { words: new Array(k).fill(0).map(() => Math.round(total / k)), block: true };
  }

  await pool(planBatches(n), SCAN_CONCURRENCY, async ([s, e]) => {
    try {
      const r = await readRange(s, e);
      r.words.forEach((w, i) => {
        if (!failed.has(s + i)) perPage[s + i] = w;
      });
      if (r.block) {
        blockBatches.push([s, e]);
        for (let p = s; p <= e; p++) if (!failed.has(p)) block.add(p);
      }
    } catch {
      for (let p = s; p <= e; p++) failed.add(p);
    }
  });

  // Control de páginas bajas: relectura sola una vez; se queda el máximo.
  const lowPages: number[] = [];
  // Tanda sin marcadores: solo se acepta como bloque si su total es verosímil
  // frente a las páginas bien leídas; vacía o casi vacía = no leída (failed).
  const medOk = median(perPage.filter((w, p) => !failed.has(p) && !block.has(p) && w > 0));
  for (const [s, e] of blockBatches) {
    let sum = 0;
    for (let p = s; p <= e; p++) sum += perPage[p];
    if (medOk === 0 || sum < LOW_RATIO * (e - s + 1) * medOk) {
      for (let p = s; p <= e; p++) {
        failed.add(p);
        block.delete(p);
        perPage[p] = 0;
      }
    }
  }
  const reliable = (p: number) => !failed.has(p);
  const med = median(perPage.filter((w, p) => reliable(p) && w > 0));
  if (med >= LOW_MEDIAN_MIN) {
    const candidates = perPage.map((w, p) => p).filter((p) => reliable(p) && !block.has(p) && perPage[p] < LOW_RATIO * med);
    await pool(candidates, SCAN_CONCURRENCY, async (p) => {
      try {
        const r = await readRange(p, p);
        if (!failed.has(p) && !r.block) perPage[p] = Math.max(perPage[p], r.words[0]);
      } catch {
        /* se queda la primera lectura */
      }
    });
    for (const p of candidates) if (perPage[p] < LOW_RATIO * med) lowPages.push(p + 1);
  }

  return {
    totalWords: perPage.reduce((a, b) => a + b, 0),
    perPage,
    lowPages,
    failedPages: [...failed].sort((a, b) => a - b).map((p) => p + 1),
    blockPages: [...block].sort((a, b) => a - b).map((p) => p + 1),
    model,
    ms: now() - t0,
    usage,
  };
}

// Aplica la mitad bilingüe a posteriori (la transcripción corre en paralelo con
// el análisis, que es quien decide is_bilingual_duplicate). Igual que
// billableWordCount por página: round(w/2).
export function halveScan(r: ScanResult): ScanResult {
  const perPage = r.perPage.map((w) => Math.round(w / 2));
  return { ...r, perPage, totalWords: perPage.reduce((a, b) => a + b, 0) };
}

// Palabras totales cuando hay páginas fallidas: lo leído + las fallidas a la mediana.
export function totalWithFailedFilled(r: ScanResult): number {
  const failed = new Set(r.failedPages.map((p) => p - 1));
  const med = median(r.perPage.filter((w, p) => !failed.has(p) && w > 0));
  return r.totalWords + Math.round(med * r.failedPages.length);
}

// Decide qué cifra y qué base se guardan: solo una lectura limpia sustituye a la
// extrapolación; con bloques, fallidas, páginas bajas o un total < 80 % de lo
// extrapolado, manda el máximo (transcrito + fallidas a la mediana, extrapolado).
export function decideScanWords(
  scan: ScanResult,
  extrapolated: number
): { words: number; basis: "transcribed_all" | "transcribed_partial" } {
  const clean =
    scan.failedPages.length === 0 &&
    scan.blockPages.length === 0 &&
    scan.lowPages.length === 0 &&
    scan.totalWords >= 0.8 * extrapolated;
  if (clean) return { words: scan.totalWords, basis: "transcribed_all" };
  return { words: Math.max(totalWithFailedFilled(scan), extrapolated), basis: "transcribed_partial" };
}
