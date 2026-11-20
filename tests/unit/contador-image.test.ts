import test from "node:test";
import assert from "node:assert/strict";
import { detectImageKind, imageEligibility, imageFrames } from "../../lib/contador/image.ts";
import { applyCounterToAnalysis, contadorClient, contadorConfig } from "../../lib/contador/core.ts";
import { submitForDocument, type ContadorDeps } from "../../lib/contador/flow.ts";

function png(w: number, h: number) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.write("IHDR", 12, "latin1");
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}
function jpeg(w: number, h: number) {
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.alloc(14)]);
  const sof = Buffer.alloc(19);
  sof.writeUInt16BE(0xffc0, 0);
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(h, 5);
  sof.writeUInt16BE(w, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.alloc(8)]);
}
function webp(w: number, h: number) {
  const b = Buffer.alloc(32);
  b.write("RIFF", 0, "latin1");
  b.write("WEBP", 8, "latin1");
  b.write("VP8X", 12, "latin1");
  b.writeUIntLE(w - 1, 24, 3);
  b.writeUIntLE(h - 1, 27, 3);
  return b;
}
function tiff(frames: Array<[number, number]>) {
  const parts: Buffer[] = [];
  const header = Buffer.alloc(8);
  header.write("II*\0", 0, "latin1");
  header.writeUInt32LE(8, 4);
  parts.push(header);
  let off = 8;
  frames.forEach(([w, h], i) => {
    const ifd = Buffer.alloc(2 + 2 * 12 + 4);
    ifd.writeUInt16LE(2, 0);
    ifd.writeUInt16LE(256, 2); ifd.writeUInt16LE(4, 4); ifd.writeUInt32LE(1, 6); ifd.writeUInt32LE(w, 10);
    ifd.writeUInt16LE(257, 14); ifd.writeUInt16LE(3, 16); ifd.writeUInt32LE(1, 18); ifd.writeUInt16LE(h, 22);
    off += ifd.length;
    ifd.writeUInt32LE(i === frames.length - 1 ? 0 : off, 26);
    parts.push(ifd);
  });
  return Buffer.concat(parts);
}
const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic", "latin1"), Buffer.alloc(16)]);

test("detecta el tipo por los bytes", () => {
  assert.equal(detectImageKind(png(10, 10)), "png");
  assert.equal(detectImageKind(jpeg(10, 10)), "jpeg");
  assert.equal(detectImageKind(webp(10, 10)), "webp");
  assert.equal(detectImageKind(tiff([[10, 10]])), "tiff");
  assert.equal(detectImageKind(heic), "heic");
  assert.equal(detectImageKind(Buffer.from("%PDF-1.7 hola mundo")), null);
});

test("dimensiones de cabecera, TIFF multipágina un frame por página", () => {
  assert.deepEqual(imageFrames(png(4000, 3000), "png"), [{ w: 4000, h: 3000 }]);
  assert.deepEqual(imageFrames(jpeg(4032, 3024), "jpeg"), [{ w: 4032, h: 3024 }]);
  assert.deepEqual(imageFrames(webp(1920, 1080), "webp"), [{ w: 1920, h: 1080 }]);
  assert.deepEqual(imageFrames(tiff([[2480, 3508], [2480, 3508], [1000, 1000]]), "tiff")?.length, 3);
});

test("elegibilidad: HEIC no, más de 20 Mpx no, cabecera ilegible no", () => {
  assert.deepEqual(imageEligibility(jpeg(4032, 3024)), { ok: true, kind: "jpeg", pages: 1 });
  assert.deepEqual(imageEligibility(tiff([[2480, 3508], [2480, 3508]])), { ok: true, kind: "tiff", pages: 2 });
  assert.deepEqual(imageEligibility(heic), { ok: false, reason: "heic_no_admitido" });
  assert.deepEqual(imageEligibility(jpeg(8000, 6000)), { ok: false, reason: "imagen_mas_de_20mpx" });
  assert.deepEqual(imageEligibility(tiff([[1000, 1000], [6000, 4000]])), { ok: false, reason: "imagen_mas_de_20mpx" });
  assert.deepEqual(imageEligibility(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(20)])), { ok: false, reason: "dimensiones_ilegibles" });
  assert.deepEqual(imageEligibility(undefined), { ok: false, reason: "sin_bytes" });
});

function deps(fetches: { n: number }): ContadorDeps {
  const cfg = contadorConfig({ CONTADOR_TRADUCAT: "on", CONTADOR_URL: "https://c.test/v1", CONTADOR_TOKEN: "t", CONTADOR_HMAC_SECRET: "s" })!;
  const client = contadorClient(cfg, async () => { fetches.n++; return { status: 202, json: async () => ({ id: "j", estado: "en_cola" }) }; });
  return {
    client,
    alertStaff: async () => {},
    log: () => {},
    repo: {
      findTrabajoByDoc: async () => null,
      findTrabajoByJobId: async () => null,
      createTrabajo: async (d) => ({ id: "t1", documentAnalysisId: d.documentAnalysisId, jobId: null, estado: "pendiente_envio", intentos: 0, paginasHechas: null, paginasTotal: null, palabrasTotal: null, palabrasPorPagina: [], paginasSinTexto: [], palabrasHaiku: null, aplicadoAt: null, abandonadoAt: null, avisoJson: null, createdAt: new Date(), updatedAt: new Date() }),
      updateTrabajo: async () => {},
      listPending: async () => [],
      countForEmailSince: async () => 0,
      loadDoc: async () => null,
      quotesForFile: async () => [],
      orderRef: async () => null,
      applyAtomically: async () => true,
      saveDocAnalysis: async () => {},
    },
  };
}
const img = (mimeType: string, bytes: Buffer) => ({ id: "d", fileUrl: "https://blob.test/f", mimeType, mode: "vision", pageCount: 1, analysisJson: {}, bytes });

test("envío de imágenes: deciden los bytes, no el mimeType declarado", async () => {
  const f = { n: 0 };
  assert.deepEqual(await submitForDocument(deps(f), img("image/heic", jpeg(3000, 2000))), { submitted: true });
  assert.deepEqual(await submitForDocument(deps(f), img("image/jpeg", heic)), { submitted: false, reason: "heic_no_admitido" });
  assert.deepEqual(await submitForDocument(deps(f), img("image/jpeg", jpeg(8000, 6000))), { submitted: false, reason: "imagen_mas_de_20mpx" });
  assert.deepEqual(await submitForDocument(deps(f), img("image/png", Buffer.from("no es imagen ninguna"))), { submitted: false, reason: "imagen_no_admitida" });
  assert.equal(f.n, 1);
});

test("TIFF multipágina: la cifra se aplica aunque el análisis viera 1 página", () => {
  const json = { document_metrics: { pages: 1, estimated_words: 300 } };
  const job = { id: "j", estado: "hecho" as const, paginas_hechas: 3, paginas_total: 3, palabras_total: 900, palabras_por_pagina: [300, 300, 300], paginas_sin_texto: [], idioma_detectado: null, motivo_error: null, referencia: "d" };
  assert.equal(applyCounterToAnalysis(json, job).applied, false);
  const out = applyCounterToAnalysis(json, job, { image: true });
  assert.ok(out.applied && out.counterWords === 900);
});
