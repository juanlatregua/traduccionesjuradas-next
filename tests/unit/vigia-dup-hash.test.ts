import test from "node:test";
import assert from "node:assert/strict";
import { cleanSha256, duplicateHashAlerts, dupHashText, type SolHashes } from "../../lib/vigia-dup-hash.ts";
import { hashFileBuffer } from "../../lib/document-dedup.ts";

const H = "1176acb13419e259a93cfc9b4518d93ad32534f4a0f7f5db4b8c9d86b09021ce";
const sol = (ref: string, over: Partial<SolHashes> = {}): SolHashes => ({ ref, status: "SENT", par: "EN>ES", createdAt: new Date("2026-11-19T02:00:00Z"), docs: [{ hash: H, name: "Facturas.pdf" }], ...over });

test("misma huella en dos solicitudes vivas → aviso con el texto pedido", () => {
  const r = duplicateHashAlerts([sol("LEAD-999C16C641"), sol("LEAD-94DAFCF6F1", { status: "PRICED", createdAt: new Date("2026-11-19T07:00:00Z") })]);
  assert.equal(r.length, 1);
  assert.equal(dupHashText(r[0]), "⚠ LEAD-999C16C641 y LEAD-94DAFCF6F1 tienen el mismo archivo (Facturas.pdf) → probable duplicado: retira una en lavori");
});

test("huellas distintas → sin aviso", () => {
  assert.equal(duplicateHashAlerts([sol("A"), sol("B", { docs: [{ hash: "f".repeat(64), name: "x.pdf" }] })]).length, 0);
});

test("una descartada (o retirada, aceptada) no cuenta como viva", () => {
  assert.equal(duplicateHashAlerts([sol("A"), sol("B", { status: "DISCARDED" })]).length, 0);
  assert.equal(duplicateHashAlerts([sol("A"), sol("B", { status: "RETIRED" })]).length, 0);
});

test("otro par de idiomas = otra solicitud legítima; sin huella no se cruza", () => {
  assert.equal(duplicateHashAlerts([sol("A"), sol("B", { par: "EN>FR" })]).length, 0);
  assert.equal(duplicateHashAlerts([sol("A", { docs: [] }), sol("B", { docs: [] })]).length, 0);
});

test("tres solicitudes con el mismo archivo → una pareja por cada par", () => {
  assert.equal(duplicateHashAlerts([sol("A"), sol("B"), sol("C")]).length, 3);
});

test("ingesta: sha256 de los bytes y validación de la huella que manda el navegador", () => {
  const h = hashFileBuffer(Buffer.from("abc"));
  assert.equal(h, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(cleanSha256(h.toUpperCase()), h);
  assert.equal(cleanSha256("zz"), null);
  assert.equal(cleanSha256(undefined), null);
});
