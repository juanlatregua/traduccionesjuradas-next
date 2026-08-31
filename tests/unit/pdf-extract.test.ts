import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedBlobUrl, safeDocName } from "../../lib/pdf-extract.ts";

test("solo se aceptan URLs de Vercel Blob (guarda anti-SSRF)", () => {
  assert.ok(isAllowedBlobUrl("https://rlaa04k5yqt7hzrr.public.blob.vercel-storage.com/expedientes/x.pdf"));
  assert.ok(!isAllowedBlobUrl("http://rlaa04k5yqt7hzrr.public.blob.vercel-storage.com/x.pdf"), "http no");
  assert.ok(!isAllowedBlobUrl("https://evil.com/x.pdf"));
  assert.ok(!isAllowedBlobUrl("https://public.blob.vercel-storage.com.evil.com/x.pdf"));
  assert.ok(!isAllowedBlobUrl("http://169.254.169.254/latest/meta-data/"), "metadata de la nube no");
  assert.ok(!isAllowedBlobUrl("file:///etc/passwd"));
  assert.ok(!isAllowedBlobUrl(""));
});

// El nombre va dentro de una cabecera Content-Disposition entre comillas: una
// comilla o un salto de linea la partirian.
test("el nombre del fichero no puede romper la cabecera", () => {
  assert.ok(!safeDocName('x" ; evil="1').includes('"'));
  assert.ok(!safeDocName("linea1\r\nSet-Cookie: a=b").includes("\n"));
  assert.ok(!safeDocName("linea1\r\nSet-Cookie: a=b").includes("\r"));
  assert.equal(safeDocName(null), "documento");
  assert.equal(safeDocName(""), "documento");
  assert.ok(safeDocName("x".repeat(200)).length <= 80);
});

test("el nombre conserva lo legible", () => {
  assert.equal(safeDocName("Apostilla (Portugues-Espanol)"), "Apostilla _Portugues-Espanol_");
});
