import test from "node:test";
import assert from "node:assert/strict";
import { decodeZipName, isZipDocument, usableZipEntry } from "../../lib/zip-entries.ts";

test("ZIP por mimetype o extensión", () => {
  assert.equal(isZipDocument({ fileName: "Remessa2.zip", mimeType: "application/octet-stream" }), true);
  assert.equal(isZipDocument({ fileName: "a.pdf", mimeType: "application/x-zip-compressed" }), true);
  assert.equal(isZipDocument({ fileName: "a.pdf", mimeType: "application/pdf" }), false);
});

test("entradas útiles: PDF e imágenes, sin basura de macOS", () => {
  assert.deepEqual(usableZipEntry("Primeira Remessa/Diploma de Graduação.pdf"), { name: "Diploma de Graduação.pdf", mimeType: "application/pdf" });
  assert.equal(usableZipEntry("__MACOSX/Primeira Remessa/._Diploma.pdf"), null);
  assert.equal(usableZipEntry("Primeira Remessa/.DS_Store"), null);
  assert.equal(usableZipEntry("notas.docx"), null);
  assert.equal(usableZipEntry("foto.JPG")?.mimeType, "image/jpeg");
});

test("nombres: UTF-8 si es válido, latin1 si no", () => {
  const utf8 = new TextEncoder().encode("Certidão – Sarah Quintão.pdf");
  assert.equal(decodeZipName(utf8), "Certidão – Sarah Quintão.pdf");
  assert.equal(decodeZipName(new Uint8Array([0x43, 0x65, 0x72, 0x74, 0x69, 0x64, 0xe3, 0x6f])), "Certidão");
});
