import test from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { readBatch, withWords } from "../../../lib/lectura/index.ts";
import { buildRequest, READING_MODEL } from "../../../lib/lectura/read.ts";
import { READING_SYSTEM_PROMPT } from "../../../lib/lectura/prompt.ts";
import { toWire, fromWire, READING_OUTPUT_FORMAT, type ModelReading } from "../../../lib/lectura/schema.ts";
import { ap, doc, reading, makeImage, makePdf } from "./fixtures.ts";

function message(content: ModelReading | string, stop_reason = "end_turn", stop_details: unknown = null) {
  return {
    id: "msg_test", type: "message", role: "assistant", model: READING_MODEL,
    content: [{ type: "thinking", thinking: "", signature: "sig" }, { type: "text", text: typeof content === "string" ? content : JSON.stringify(toWire(content)) }],
    stop_reason, stop_details, stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 200, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0, iterations: null },
  } as never;
}

function fakeModel(replies: Array<unknown | Error>) {
  const calls: any[] = [];
  const call = async (params: any) => {
    calls.push(params);
    const next = replies[calls.length - 1];
    if (next instanceof Error) throw next;
    if (next === undefined) throw new Error("more calls than expected");
    return next as never;
  };
  return { call, calls };
}

async function twoFiles() {
  return [
    { name: "acta.pdf", bytes: await makePdf(["", ""]) },
    { name: "apostilla.jpg", bytes: await makeImage("jpeg") },
  ];
}

const good = () => reading([doc("D1", [[1, 1], [1, 2]], { apostille: ap([[2, 1]]) })]);
const ctx = { clientMessage: "Necesito la traducción para el lunes" };

test("valid reading on the first call: documents, usage and cost", async () => {
  const fake = fakeModel([message(good())]);
  const r = await readBatch(await twoFiles(), ctx, { callModel: fake.call });
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.attempts, 1);
  assert.equal(r.documents.length, 1);
  assert.equal(r.documents[0].wordsBasis, "estimated");
  assert.equal(r.documents[0].words, 200);
  assert.deepEqual(r.usage, { input: 1000, output: 200, cacheRead: 3000, cacheWrite: 0 });
  assert.equal(r.cost.usd, (1000 * 400 + 200 * 2000 + 3000 * 20) / 1e8);

  const p = fake.calls[0];
  assert.equal(p.model, "claude-opus-5-5");
  assert.equal(p.output_config.effort, "medium");
  assert.equal(p.output_config.format.type, "json_schema");
  assert.equal(p.tool_choice, undefined);
  assert.equal(p.thinking, undefined);
  assert.deepEqual(p.system[0].cache_control, { type: "ephemeral" });
  const blocks = p.messages[0].content;
  assert.deepEqual(blocks.map((b: any) => b.type), ["text", "document", "text", "image", "text"]);
  assert.match(blocks[0].text, /^Archivo 1: 2 páginas/);
  assert.match(blocks[2].text, /^Archivo 2: 1 página/);
  assert.match(blocks[4].text, /<datos_cliente>[\s\S]*Archivo 1: «acta\.pdf»[\s\S]*<\/datos_cliente>/);
  assert.deepEqual(blocks[3].cache_control, { type: "ephemeral" });
  assert.equal(blocks[4].cache_control, undefined);
  assert.match(blocks[4].text, /Necesito la traducción para el lunes/);
});

test("invalid → one retry naming the problem → valid", async () => {
  const bad = reading([doc("D1", [[1, 1]])]);
  const fake = fakeModel([message(bad), message(good())]);
  const r = await readBatch(await twoFiles(), ctx, { callModel: fake.call });
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.attempts, 2);
  assert.equal(r.usage.input, 2000);
  const retry = fake.calls[1].messages;
  assert.equal(retry.length, 3);
  assert.equal(retry[1].role, "assistant");
  assert.match(retry[2].content[0].text, /archivo 1 pág. 2 no está asignada a nada/);
  assert.match(retry[2].content[0].text, /archivo 2 pág. 1 no está asignada a nada/);
});

test("invalid twice → invalid with the errors, nothing patched", async () => {
  const bad = reading([doc("D1", [[1, 1]])]);
  const fake = fakeModel([message(bad), message("esto no es json")]);
  const r = await readBatch(await twoFiles(), ctx, { callModel: fake.call });
  assert.equal(r.status, "invalid");
  if (r.status !== "invalid") return;
  assert.deepEqual(r.errors, ["La respuesta no era JSON válido."]);
  assert.equal(r.reading?.documents[0].parts.length, 1);
  assert.equal(fake.calls.length, 2);
});

test("refusal and max_tokens are typed results, not exceptions", async () => {
  const refused = await readBatch(await twoFiles(), ctx, { callModel: fakeModel([message("", "refusal", { category: "bio", explanation: "x" })]).call });
  assert.equal(refused.status, "refused");
  if (refused.status === "refused") assert.equal(refused.category, "bio");
  const cut = await readBatch(await twoFiles(), ctx, { callModel: fakeModel([message('{"documents":[', "max_tokens")]).call });
  assert.equal(cut.status, "truncated");
  if (cut.status === "truncated") assert.equal(cut.usage.output, 200);
});

test("network and rate-limit errors map to typed errors", async () => {
  const net = await readBatch(await twoFiles(), ctx, { callModel: fakeModel([new Anthropic.APIConnectionError({ message: "ECONNRESET" })]).call });
  assert.equal(net.status, "error");
  if (net.status === "error") assert.equal(net.error.kind, "connection");
  const rl = new Anthropic.RateLimitError(429, { type: "error", error: { type: "rate_limit_error", message: "slow down" } }, "slow down", new Headers());
  const limited = await readBatch(await twoFiles(), ctx, { callModel: fakeModel([rl]).call });
  assert.equal(limited.status, "error");
  if (limited.status === "error") assert.deepEqual([limited.error.kind, limited.error.httpStatus], ["rate_limit", 429]);
});

test("too large never calls the model", async () => {
  const fake = fakeModel([]);
  const r = await readBatch(await twoFiles(), ctx, { callModel: fake.call, limits: { ...(await import("../../../lib/lectura/prepare.ts")).DEFAULT_LIMITS, maxPages: 2 } });
  assert.equal(r.status, "too_large");
  assert.equal(fake.calls.length, 0);
});

test("exact words replace the estimate only when every page has a reliable text layer", () => {
  const page = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
  const batch = {
    files: [
      { index: 1, pageCount: 2, textLayer: true, pageTexts: [page(120), page(80)], pageWords: [120, 80] },
      { index: 2, pageCount: 1, textLayer: false, pageTexts: null, pageWords: null },
    ],
  } as never;
  const r = reading([doc("D1", [[1, 1], [1, 2]]), doc("D2", [[1, 1]], { isBilingualDuplicate: true }), doc("D3", [[2, 1]], { estimatedWords: 90 })]);
  const docs = withWords(batch, r);
  assert.deepEqual(docs.map((d) => [d.words, d.wordsBasis]), [[200, "exact"], [60, "exact"], [90, "estimated"]]);
});

test("the system prompt is stable: no dates, ids or names inside", () => {
  assert.doesNotMatch(READING_SYSTEM_PROMPT, /\b20\d\d\b|EXP-|cmw|@/);
  const a = buildRequest([{ role: "user", content: "x" }]);
  const b = buildRequest([{ role: "user", content: "y" }]);
  assert.deepEqual(a.system, b.system);
});

test("wire format: round trip, absent values become null, malformed pages are errors", () => {
  const r = reading([doc("D1", [[1, 1], [2, 1]], { apostille: ap([]) })], {
    duplicates: [{ parts: [{ fileIndex: 3, page: 1 }], duplicateOf: { documentId: "D1", parts: [] } }],
  });
  assert.deepEqual(fromWire(toWire(r)), { reading: r, errors: [] });
  const w = toWire(r);
  w.documents[0].parts.push("tres");
  w.documents[0].holder = "  ";
  const back = fromWire(w);
  assert.equal(back.reading.documents[0].holder, null);
  assert.deepEqual(back.errors, ['el documento D1: «tres» no es una página con formato "N.p".']);
});

test("the wire schema has no unions (grammar size limit)", () => {
  const json = JSON.stringify(READING_OUTPUT_FORMAT.schema);
  assert.doesNotMatch(json, /anyOf|"null"/);
});
