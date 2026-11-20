import test from "node:test";
import assert from "node:assert/strict";
import {
  planBatches,
  parseMarkedPages,
  median,
  transcribeScannedPdf,
  halveScan,
  totalWithFailedFilled,
  scanFullCountEnabled,
  SCAN_PROMPT,
  type ScanCallInput,
  type ScanCallOutput,
} from "../../lib/ai/transcribe-scan.ts";

const words = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ");
const marked = (counts: number[]) =>
  counts.map((c, i) => `=== PÁGINA ${i + 1} ===\n${words(c)}`).join("\n");
const ok = (text: string, stopReason: string | null = "end_turn"): ScanCallOutput => ({
  text,
  stopReason,
  usage: { input: 100, output: 50 },
});

// slicePdf falso: codifica el rango en el "base64" para que callModel sepa qué páginas son.
const slicePdf = async (s: number, e: number) => `${s}-${e}`;
const rangeOf = (i: ScanCallInput) => i.pdfBase64.split("-").map(Number) as [number, number];

test("planBatches trocea en tandas de 4 con última menor", () => {
  assert.deepEqual(planBatches(10), [[0, 3], [4, 7], [8, 9]]);
  assert.deepEqual(planBatches(4), [[0, 3]]);
  assert.equal(planBatches(24).length, 6);
});

test("parseMarkedPages: parsea marcadores consecutivos y rechaza los que no cuadran", () => {
  const p = parseMarkedPages(marked([3, 5]), 2)!;
  assert.equal(p.length, 2);
  assert.equal(p[1].trim().split(/\s+/).length, 5);
  assert.equal(parseMarkedPages(marked([3, 5]), 3), null);
  assert.equal(parseMarkedPages("=== PÁGINA 2 ===\na\n=== PÁGINA 1 ===\nb", 2), null);
  assert.equal(parseMarkedPages("sin marcadores", 1), null);
});

test("median", () => {
  assert.equal(median([]), 0);
  assert.equal(median([1, 5, 3]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test("cuenta todas las páginas por tandas y suma", async () => {
  const calls: Array<[number, number]> = [];
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 6 }, {
    slicePdf,
    callModel: async (i) => {
      const [s, e] = rangeOf(i);
      calls.push([s, e]);
      return ok(marked(Array.from({ length: e - s + 1 }, (_, k) => 200 + s + k)));
    },
  });
  assert.deepEqual(calls.sort((a, b) => a[0] - b[0]), [[0, 3], [4, 5]]);
  assert.deepEqual(r.perPage, [200, 201, 202, 203, 204, 205]);
  assert.equal(r.totalWords, 1215);
  assert.deepEqual(r.failedPages, []);
  assert.deepEqual(r.lowPages, []);
  assert.equal(r.usage.input, 200);
});

test("página baja: se relee sola, se queda el máximo", async () => {
  let rereads = 0;
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 4 }, {
    slicePdf,
    callModel: async (i) => {
      const [s, e] = rangeOf(i);
      if (s === e) {
        rereads++;
        return ok(marked([s === 2 ? 180 : 0]));
      }
      return ok(marked([300, 300, 20, 300]));
    },
  });
  assert.equal(rereads, 1);
  assert.equal(r.perPage[2], 180);
  assert.deepEqual(r.lowPages, []); // 180 >= 35 % de 300
});

test("página baja persistente va a lowPages (no es error)", async () => {
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 4 }, {
    slicePdf,
    callModel: async (i) => {
      const [s, e] = rangeOf(i);
      return s === e ? ok(marked([30])) : ok(marked([300, 300, 20, 300]));
    },
  });
  assert.equal(r.perPage[2], 30);
  assert.deepEqual(r.lowPages, [3]);
  assert.deepEqual(r.failedPages, []);
});

test("mediana < 120: no se releen páginas", async () => {
  let calls = 0;
  await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 4 }, {
    slicePdf,
    callModel: async () => (calls++, ok(marked([50, 50, 5, 50]))),
  });
  assert.equal(calls, 1);
});

test("tanda que falla va a failedPages y se rellena con la mediana", async () => {
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 8 }, {
    slicePdf,
    callModel: async (i) => {
      const [s, e] = rangeOf(i);
      if (s === 4) throw new Error("timeout");
      return ok(marked(Array.from({ length: e - s + 1 }, () => 250)));
    },
  });
  assert.deepEqual(r.failedPages, [5, 6, 7, 8]);
  assert.equal(r.totalWords, 1000);
  assert.equal(totalWithFailedFilled(r), 2000);
});

test("max_tokens: la tanda se parte en páginas sueltas", async () => {
  const seen: string[] = [];
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 4 }, {
    slicePdf,
    callModel: async (i) => {
      seen.push(i.pdfBase64);
      const [s, e] = rangeOf(i);
      if (s === 0 && e === 3) return ok(marked([100]), "max_tokens");
      return ok(marked([200]));
    },
  });
  assert.deepEqual(seen, ["0-3", "0-0", "1-1", "2-2", "3-3"]);
  assert.equal(r.totalWords, 800);
  assert.deepEqual(r.failedPages, []);
});

test("página suelta truncada por max_tokens -> failedPages", async () => {
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 1 }, {
    slicePdf,
    callModel: async () => ok(marked([100]), "max_tokens"),
  });
  assert.deepEqual(r.failedPages, [1]);
});

test("marcadores que no cuadran con total verosímil: bloque repartido y marcado", async () => {
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 8 }, {
    slicePdf,
    callModel: async (i) => {
      const [s] = rangeOf(i);
      return s === 4 ? ok(`=== PÁGINA 1 ===\n${words(400)}`) : ok(marked([100, 100, 100, 100]));
    },
  });
  assert.equal(r.totalWords, 800);
  assert.deepEqual(r.blockPages, [5, 6, 7, 8]);
  assert.deepEqual(r.perPage.slice(4), [100, 100, 100, 100]);
});

test("reintenta una vez una llamada que falla", async () => {
  let n = 0;
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 2 }, {
    slicePdf,
    callModel: async () => {
      if (n++ === 0) throw new Error("529");
      return ok(marked([10, 10]));
    },
  });
  assert.equal(n, 2);
  assert.equal(r.totalWords, 20);
});

test("bilingüe: billable por página y halveScan equivalen", async () => {
  const deps = { slicePdf, callModel: async () => ok(marked([201, 200])) };
  const a = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 2, bilingualDuplicate: true }, deps);
  const b = halveScan(await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 2 }, deps));
  assert.deepEqual(a.perPage, b.perPage);
  assert.equal(b.totalWords, 101 + 100);
});

test("interruptor SCAN_FULL_COUNT=off se lee en ejecución", () => {
  const prev = process.env.SCAN_FULL_COUNT;
  delete process.env.SCAN_FULL_COUNT;
  assert.equal(scanFullCountEnabled(), true);
  process.env.SCAN_FULL_COUNT = "off";
  assert.equal(scanFullCountEnabled(), false);
  process.env.SCAN_FULL_COUNT = "OFF ";
  assert.equal(scanFullCountEnabled(), false);
  if (prev === undefined) delete process.env.SCAN_FULL_COUNT;
  else process.env.SCAN_FULL_COUNT = prev;
});

import { decideScanWords, scanModel } from "../../lib/ai/transcribe-scan.ts";
import { HAIKU_MODEL, SONNET_MODEL } from "../../lib/ai/models.ts";

test("tanda sin marcadores y casi vacía NO se da por buena: failedPages", async () => {
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 8 }, {
    slicePdf,
    callModel: async (i) => {
      const [s, e] = rangeOf(i);
      if (s === 4) return ok("no puedo leer esto");
      return ok(marked(Array.from({ length: e - s + 1 }, () => 300)));
    },
  });
  assert.deepEqual(r.failedPages, [5, 6, 7, 8]);
  assert.deepEqual(r.blockPages, []);
  assert.equal(r.totalWords, 1200);
});

test("todo el documento sin marcadores (mediana 0): todo failed", async () => {
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 4 }, {
    slicePdf,
    callModel: async () => ok(words(900)),
  });
  assert.deepEqual(r.failedPages, [1, 2, 3, 4]);
  assert.equal(r.totalWords, 0);
});

test("tanda sin marcadores pero verosímil sigue como bloque", async () => {
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 8 }, {
    slicePdf,
    callModel: async (i) => {
      const [s, e] = rangeOf(i);
      return s === 4 ? ok(words(1000)) : ok(marked(Array.from({ length: e - s + 1 }, () => 300)));
    },
  });
  assert.deepEqual(r.blockPages, [5, 6, 7, 8]);
  assert.deepEqual(r.failedPages, []);
});

test("decideScanWords: limpio sustituye; parcial/bajo toma el máximo con la extrapolación", () => {
  const base = { perPage: [300, 300], lowPages: [], failedPages: [], blockPages: [], model: "m", ms: 1, usage: { input: 0, output: 0 } };
  assert.deepEqual(decideScanWords({ ...base, totalWords: 600 }, 700), { words: 600, basis: "transcribed_all" });
  assert.deepEqual(decideScanWords({ ...base, totalWords: 600 }, 900), { words: 900, basis: "transcribed_partial" });
  assert.deepEqual(decideScanWords({ ...base, totalWords: 600, lowPages: [2] }, 500), { words: 600, basis: "transcribed_partial" });
  assert.deepEqual(decideScanWords({ ...base, totalWords: 300, perPage: [300, 0], failedPages: [2] }, 400), { words: 600, basis: "transcribed_partial" });
  assert.deepEqual(decideScanWords({ ...base, totalWords: 600, blockPages: [1] }, 100), { words: 600, basis: "transcribed_partial" });
});

test("scanModel: Haiku por defecto, SCAN_MODEL=sonnet lo cambia (en ejecución)", () => {
  const prev = process.env.SCAN_MODEL;
  delete process.env.SCAN_MODEL;
  assert.equal(scanModel(), HAIKU_MODEL);
  process.env.SCAN_MODEL = "Sonnet";
  assert.equal(scanModel(), SONNET_MODEL);
  if (prev === undefined) delete process.env.SCAN_MODEL;
  else process.env.SCAN_MODEL = prev;
});

test("señal abortada: no se llama al modelo y todo va a failed", async () => {
  const ac = new AbortController();
  ac.abort();
  let calls = 0;
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 4 }, {
    slicePdf,
    signal: ac.signal,
    callModel: async () => (calls++, ok(marked([10, 10, 10, 10]))),
  });
  assert.equal(calls, 0);
  assert.deepEqual(r.failedPages, [1, 2, 3, 4]);
});

test("sin presupuesto: no se trocea ni se llama", async () => {
  let sliced = 0;
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 4, totalBudgetMs: 1000 }, {
    slicePdf: async (s, e) => (sliced++, `${s}-${e}`),
    callModel: async () => ok(marked([10, 10, 10, 10])),
  });
  assert.equal(sliced, 0);
  assert.deepEqual(r.failedPages, [1, 2, 3, 4]);
});

test("el prompt prohíbe traducir, resumir, completar e inventar cabeceras", () => {
  const p = SCAN_PROMPT(4);
  for (const frag of ["No traduzcas", "no resumas", "No completes", "no reconstruyas", "no repitas encabezados", "=== PÁGINA 1 ==="]) {
    assert.ok(p.includes(frag), `falta «${frag}»`);
  }
});
