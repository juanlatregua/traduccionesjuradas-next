import test from "node:test";
import assert from "node:assert/strict";
import { isOwnBlobUrl } from "../../lib/q-journey.ts";

const TOKEN = "vercel_blob_rw_AbC123xyz_secretsecret";
const HOST = "abc123xyz.public.blob.vercel-storage.com";

test("acepta URLs https de nuestra tienda", () => {
  assert.equal(isOwnBlobUrl(`https://${HOST}/docs/a-Xy12.pdf`, TOKEN), true);
});

test("rechaza otra tienda de Vercel Blob cuando el token da el id", () => {
  assert.equal(isOwnBlobUrl("https://otra.public.blob.vercel-storage.com/a.pdf", TOKEN), false);
});

test("rechaza http, hosts ajenos, credenciales, puerto y basura", () => {
  assert.equal(isOwnBlobUrl(`http://${HOST}/a.pdf`, TOKEN), false);
  assert.equal(isOwnBlobUrl("https://evil.example/a.pdf", TOKEN), false);
  assert.equal(isOwnBlobUrl(`https://${HOST}.evil.example/a.pdf`, TOKEN), false);
  assert.equal(isOwnBlobUrl(`https://x@${HOST}/a.pdf`, TOKEN), false);
  assert.equal(isOwnBlobUrl(`https://${HOST}:8443/a.pdf`, TOKEN), false);
  assert.equal(isOwnBlobUrl("http://169.254.169.254/latest", TOKEN), false);
  assert.equal(isOwnBlobUrl("no es url", TOKEN), false);
  assert.equal(isOwnBlobUrl(undefined, TOKEN), false);
  assert.equal(isOwnBlobUrl(42, TOKEN), false);
});

test("sin id en el token cae al sufijo de Vercel Blob", () => {
  assert.equal(isOwnBlobUrl("https://cualquiera.public.blob.vercel-storage.com/a.pdf", undefined), true);
  assert.equal(isOwnBlobUrl("https://evil.example/a.pdf", undefined), false);
});
