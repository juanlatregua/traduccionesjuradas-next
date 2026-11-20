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

test("marcadores que no cuadran: la tanda cuenta como bloque y se marca", async () => {
  const r = await transcribeScannedPdf(Buffer.alloc(0), { pageCount: 4 }, {
    slicePdf,
    callModel: async () => ok(`=== PÁGINA 1 ===\n${words(400)}`),
  });
  assert.equal(r.totalWords, 400);
  assert.deepEqual(r.blockPages, [1, 2, 3, 4]);
  assert.deepEqual(r.perPage, [100, 100, 100, 100]);
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
