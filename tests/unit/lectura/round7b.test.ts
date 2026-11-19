import test from "node:test";
import assert from "node:assert/strict";
import { HeavyWorker, WorkerOutOfMemory, workerSource } from "../../../lib/lectura/heavy.ts";
import { ceilingAbove } from "./fixtures.ts";

const MB = 1024 * 1024;

test("native tasks (sharp) over the ceiling are the file's own fault: out of memory, never busy", async () => {
  const src = workerSource(`image: async ({ ms }) => { await new Promise((r) => setTimeout(r, ms)); return {}; },`);
  const w = new HeavyWorker({ memoryMb: 2048, rssCeilingMb: ceilingAbove(200), timeoutMs: 20_000 }, src);
  const hold: Buffer[] = [];
  try {
    await w.run("image", { ms: 1 });
    const pending = w.run("image", { ms: 3000 });
    await new Promise((r) => setTimeout(r, 200));
    for (let i = 0; i < 60; i++) hold.push(Buffer.alloc(10 * MB, 1));
    await assert.rejects(pending, WorkerOutOfMemory);
  } finally {
    hold.length = 0;
    await w.close();
  }
});
