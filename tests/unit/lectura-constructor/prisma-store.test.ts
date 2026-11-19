import test from "node:test";
import assert from "node:assert/strict";
import { prismaLecturaStore } from "../../../lib/lectura-constructor/prisma-store.ts";
import { ActiveConflict } from "../../../lib/lectura-constructor/store.ts";
import { working } from "./fakes.ts";

type Call = { model: string; op: string; args: any };

function fakeDb(answers: Record<string, (args: any) => unknown> = {}) {
  const calls: Call[] = [];
  const model = (name: string) =>
    new Proxy({}, {
      get: (_t, op: string) => async (args: any) => {
        calls.push({ model: name, op, args });
        const fn = answers[`${name}.${op}`];
        return fn ? fn(args) : op === "updateMany" || op === "deleteMany" ? { count: 1 } : {};
      },
    });
  const db: any = { lecturaLote: model("lote"), lecturaArchivo: model("archivo"), lecturaDocumento: model("documento") };
  db.$transaction = async (fn: (tx: unknown) => unknown) => fn(db);
  return { db, calls };
}

const row = { id: "L1", fingerprint: "fp", activeKey: "fp", status: "running", busyAttempts: 0, casoId: "c", sessionKey: null, quoteId: null, targetLang: "es", targetLangBasis: null, promptVersion: "p", clean: null, reasonsJson: null, readingJson: null, detailEs: null, costJson: null, createdBy: "j", confirmedBy: null, confirmedAt: null, linesJson: null, createdAt: new Date(), updatedAt: new Date() };
const input = { casoId: "c", sessionKey: null, quoteId: null, fingerprint: "fp", targetLang: "es", promptVersion: "p", createdBy: "j" };

test("createRunning holds the fingerprint in the unique activeKey; a unique violation is an ActiveConflict", async () => {
  const { db, calls } = fakeDb({ "lote.create": () => row });
  const created = await prismaLecturaStore(db).createRunning(input);
  assert.equal(created.status, "running");
  assert.equal(calls[0].args.data.activeKey, "fp");
  assert.equal(calls[0].args.data.busyAttempts, 0);
  const dup = fakeDb({ "lote.create": () => { throw Object.assign(new Error("unique"), { code: "P2002" }); } });
  await assert.rejects(prismaLecturaStore(dup.db).createRunning(input), ActiveConflict);
});

test("claim only takes a busy lote or a stale running one, still active", async () => {
  const { db, calls } = fakeDb();
  const stale = new Date("2026-11-19T10:00:00Z");
  assert.equal(await prismaLecturaStore(db).claim("L1", stale), true);
  const where = calls[0].args.where;
  assert.deepEqual(where.activeKey, { not: null });
  assert.deepEqual(where.OR, [{ status: "busy" }, { status: "running", updatedAt: { lt: stale } }]);
  const none = fakeDb({ "lote.updateMany": () => ({ count: 0 }) });
  assert.equal(await prismaLecturaStore(none.db).claim("L1", stale), false);
});

test("markBusy stores the server's attempt count and keeps the fingerprint; finish frees it and writes the rows", async () => {
  const { db, calls } = fakeDb();
  const store = prismaLecturaStore(db);
  await store.markBusy("L1", 2, [{ position: null, name: "a.pdf", url: "u", sha256: null, pageCount: null, state: "busy", reasonEs: "ocupado" }], "ocupado");
  const busy = calls.find((c) => c.model === "lote" && c.op === "update")!;
  assert.equal(busy.args.data.busyAttempts, 2);
  assert.equal(busy.args.data.status, "busy");
  assert.equal("activeKey" in busy.args.data, false);

  calls.length = 0;
  const d = working("D1", [[1, 1]], {}, { manualPriceCents: 4000 });
  await store.finish("L1", { status: "ok", targetLang: "es", targetLangBasis: "stated_by_client", clean: false, reasons: [], reading: {}, detailEs: null, cost: null, files: [], documents: [d] });
  const fin = calls.find((c) => c.model === "lote" && c.op === "update")!;
  assert.equal(fin.args.data.activeKey, null);
  const docs = calls.find((c) => c.model === "documento" && c.op === "createMany")!;
  assert.equal(docs.args.data[0].manualPriceCents, 4000);
  assert.equal(docs.args.data[0].pageCount, 1);
});

test("edits and confirmation only while the lote is «ok»", async () => {
  const { db, calls } = fakeDb({ "lote.updateMany": () => ({ count: 0 }) });
  const store = prismaLecturaStore(db);
  assert.equal(await store.replaceDocuments("L1", [working("D1", [[1, 1]])]), false);
  assert.equal(calls.some((c) => c.model === "documento"), false);
  const seen = new Date("2026-11-19T10:00:00.123Z");
  assert.equal(await store.confirm("L1", "j", {}, seen), false);
  assert.deepEqual(calls.at(-1)!.args.where, { id: "L1", status: "ok", updatedAt: seen });
  assert.equal(await store.linkQuote("L1", "q1"), false);
  assert.deepEqual(calls.at(-1)!.args.where, { id: "L1", status: "confirmed", quoteId: null });
});
