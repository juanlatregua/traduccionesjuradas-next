import test from "node:test";
import assert from "node:assert/strict";
import { costOf, usageMicroCents } from "../../../lib/lectura/cost.ts";
import { countWords, billableWords, isReliableTextLayer } from "../../../lib/lectura/words.ts";

test("Opus 5.5 cost: 4 $ in, 20 $ out, 0.20 $ cache read per MTok", () => {
  const usage = { model: "claude-opus-5-5", input: 1_000_000, output: 100_000, cacheRead: 500_000, cacheWrite: 0 };
  assert.equal(usageMicroCents(usage), 1_000_000 * 400 + 100_000 * 2000 + 500_000 * 20);
  const c = costOf([usage], 0.9);
  assert.equal(c.usd, 6.1);
  assert.equal(c.eurCents, 549);
  assert.deepEqual(c.unpricedModels, []);
});

test("unknown models are reported, not guessed", () => {
  const c = costOf([{ model: "claude-x", input: 10, output: 10, cacheRead: 0, cacheWrite: 0 }]);
  assert.equal(c.usd, 0);
  assert.deepEqual(c.unpricedModels, ["claude-x"]);
});

test("word count like Word; bilingual duplicate halves; text-layer reliability", () => {
  assert.equal(countWords("Acte de naissance n° 12/2024 — 1.210 € … «Dou fé»"), 8);
  assert.equal(countWords("شهادة ميلاد 2024"), 3);
  assert.equal(billableWords(301, true), 151);
  assert.equal(billableWords(301, false), 301);
  assert.equal(isReliableTextLayer([0, 0, 0, 0, 540]), false);
  assert.equal(isReliableTextLayer([120, 80]), true);
});
