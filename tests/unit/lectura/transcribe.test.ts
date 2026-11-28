import test from "node:test";
import assert from "node:assert/strict";
import { readBatch } from "../../../lib/lectura/index.ts";
import { READING_MODEL } from "../../../lib/lectura/read.ts";
import { toWire, type ModelReading } from "../../../lib/lectura/schema.ts";
import { transcribeOn } from "../../../lib/lectura/transcribe.ts";
import type { ScanCallInput, ScanCallOutput } from "../../../lib/ai/transcribe-scan.ts";
import { doc, lorem, makeImage, makePdf, reading } from "./fixtures.ts";

function message(content: ModelReading) {
  return {
    id: "msg_test", type: "message", role: "assistant", model: READING_MODEL,
    content: [{ type: "text", text: JSON.stringify(toWire(content)) }],
    stop_reason: "end_turn", stop_details: null, stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, iterations: null },
  } as never;
}

const readingModel = (r: ModelReading) => async () => message(r);

const marked = (counts: number[]) => counts.map((c, i) => `=== PÁGINA ${i + 1} ===\n${lorem(c)}`).join("\n");

/** Words per page of the assembled document; `fail` = 0-based pages whose call always throws. */
function scanModel(perPage: number[], fail: number[] = []) {
  const calls: ScanCallInput[] = [];
  const slicePdf = async (s: number, e: number) => `${s}-${e}`;
  const callModel = async (input: ScanCallInput): Promise<ScanCallOutput> => {
    calls.push(input);
    const [s, e] = input.pdfBase64.split("-").map(Number);
    for (let p = s; p <= e; p++) if (fail.includes(p)) throw new Error("timeout");
    return { text: marked(perPage.slice(s, e + 1)), stopReason: "end_turn", usage: { input: 2000, output: 500 } };
  };
  return { calls, deps: { scan: { callModel, slicePdf } } };
}

async function withSwitch<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const before = process.env.LECTURA_TRANSCRIBIR;
  if (value === undefined) delete process.env.LECTURA_TRANSCRIBIR;
  else process.env.LECTURA_TRANSCRIBIR = value;
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env.LECTURA_TRANSCRIBIR;
    else process.env.LECTURA_TRANSCRIBIR = before;
  }
}

const scan2 = async () => [{ name: "antecedentes.pdf", bytes: await makePdf(["", ""]) }];
const twoPages = (extra = {}) => reading([doc("D1", [[1, 1], [1, 2]], { type: "criminal_record", category: "legal", estimatedWords: 300, ...extra })]);

test("only LECTURA_TRANSCRIBIR=on switches it on", () => {
  assert.equal(transcribeOn({ LECTURA_TRANSCRIBIR: "on" }), true);
  assert.equal(transcribeOn({ LECTURA_TRANSCRIBIR: " ON " }), true);
  assert.equal(transcribeOn({ LECTURA_TRANSCRIBIR: "off" }), false);
  assert.equal(transcribeOn({}), false);
});

test("scanned document of 2 pages: words are transcribed and counted, cost added to the batch", async () => {
  const fake = scanModel([180, 170]);
  const r = await withSwitch("on", async () => readBatch(await scan2(), {}, { callModel: readingModel(twoPages()), transcribe: fake.deps }));
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const d = r.documents[0];
  assert.equal(d.wordsBasis, "transcribed");
  assert.equal(d.words, 350);
  assert.equal(d.estimatedWords, 300);
  assert.deepEqual(d.transcription?.perPage, [180, 170]);
  assert.equal(fake.calls.length, 1);
  assert.ok(!r.assessment.reasons.some((x) => x.code === "transcription_incomplete" || x.code === "words_estimated_price"));
  assert.deepEqual(r.usages.map((u) => u.model), [READING_MODEL, "claude-haiku-5-5"]);
  assert.equal(r.cost.usd, (1000 * 400 + 200 * 2000 + 2000 * 10 + 500 * 50) / 1e8);
});

test("a page that cannot be transcribed keeps its share of the estimate and asks for a person", async () => {
  const fake = scanModel([180, 170, 160, 150, 140], [4]);
  const files = [{ name: "sentencia.pdf", bytes: await makePdf(["", "", "", "", ""]) }];
  const r5 = reading([doc("D1", [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5]], { type: "divorce_decree", category: "legal", estimatedWords: 500, declaredPages: 5 })]);
  const r = await withSwitch("on", () => readBatch(files, {}, { callModel: readingModel(r5), transcribe: fake.deps }));
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const d = r.documents[0];
  assert.equal(d.wordsBasis, "estimated");
  assert.equal(d.words, 180 + 170 + 160 + 150 + 100);
  assert.deepEqual(d.transcription?.failedPages, [5]);
  assert.equal(r.assessment.clean, false);
  assert.ok(r.assessment.reasons.some((x) => x.code === "transcription_incomplete" && x.documentId === "D1"));
});

test("pages far below the median are flagged for review", async () => {
  const fake = scanModel([300, 310, 20, 290]);
  const files = [{ name: "contrato.pdf", bytes: await makePdf(["", "", "", ""]) }];
  const r4 = reading([doc("D1", [[1, 1], [1, 2], [1, 3], [1, 4]], { type: "contract", category: "legal", estimatedWords: 900, declaredPages: 4 })]);
  const r = await withSwitch("on", () => readBatch(files, {}, { callModel: readingModel(r4), transcribe: fake.deps }));
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.documents[0].wordsBasis, "transcribed");
  assert.deepEqual(r.documents[0].transcription?.lowPages, [3]);
  assert.ok(r.assessment.reasons.some((x) => x.code === "transcription_low_pages"));
});

test("bilingual duplicate: transcribed words are halved", async () => {
  const fake = scanModel([180, 170]);
  const r = await withSwitch("on", async () => readBatch(await scan2(), {}, { callModel: readingModel(twoPages({ isBilingualDuplicate: true, estimatedWords: 175 })), transcribe: fake.deps }));
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.documents[0].wordsBasis, "transcribed");
  assert.equal(r.documents[0].words, 175);
});

test("PDF with a reliable text layer is counted exactly and never transcribed", async () => {
  const fake = scanModel([999]);
  const files = [{ name: "acta.pdf", bytes: await makePdf([lorem(120)]) }];
  const r = await withSwitch("on", () => readBatch(files, {}, { callModel: readingModel(reading([doc("D1", [[1, 1]], { estimatedWords: 110 })])), transcribe: fake.deps }));
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.documents[0].wordsBasis, "exact");
  assert.equal(r.documents[0].words, 120);
  assert.equal(r.documents[0].transcription, undefined);
  assert.equal(fake.calls.length, 0);
  assert.equal(r.usages.length, 1);
});

test("photo: the image is assembled into a PDF and transcribed (real slicer)", async () => {
  const calls: ScanCallInput[] = [];
  const callModel = async (input: ScanCallInput): Promise<ScanCallOutput> => {
    calls.push(input);
    return { text: marked([140]), stopReason: "end_turn", usage: { input: 1500, output: 300 } };
  };
  const files = [{ name: "foto.jpg", bytes: await makeImage("jpeg") }];
  const r = await withSwitch("on", () => readBatch(files, {}, { callModel: readingModel(reading([doc("D1", [[1, 1]], { estimatedWords: 120 })])), transcribe: { scan: { callModel } } }));
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.documents[0].wordsBasis, "transcribed");
  assert.equal(r.documents[0].words, 140);
  assert.equal(calls.length, 1);
  assert.ok(Buffer.from(calls[0].pdfBase64, "base64").subarray(0, 5).toString() === "%PDF-");
});

test("no time left before the deadline: the estimate stays and is marked", async () => {
  const fake = scanModel([180, 170]);
  const r = await withSwitch("on", async () => readBatch(await scan2(), {}, { callModel: readingModel(twoPages()), transcribe: fake.deps, deadlineAt: Date.now() + 5_000 }));
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.documents[0].wordsBasis, "estimated");
  assert.equal(r.documents[0].words, 300);
  assert.equal(fake.calls.length, 0);
  assert.ok(r.assessment.reasons.some((x) => x.code === "transcription_incomplete"));
});

test("switch off: identical to today (estimate, no transcription, same reasons)", async () => {
  const fake = scanModel([180, 170]);
  const run = (v: string | undefined) => withSwitch(v, async () => readBatch(await scan2(), {}, { callModel: readingModel(twoPages()), transcribe: fake.deps }));
  const off = await run(undefined);
  const other = await run("yes");
  assert.equal(fake.calls.length, 0);
  for (const r of [off, other]) {
    assert.equal(r.status, "ok");
    if (r.status !== "ok") return;
    assert.equal(r.documents[0].wordsBasis, "estimated");
    assert.equal(r.documents[0].words, 300);
    assert.equal(r.documents[0].transcription, undefined);
    assert.equal(r.usages.length, 1);
  }
  if (off.status === "ok" && other.status === "ok") assert.deepEqual(off.assessment, other.assessment);
});
