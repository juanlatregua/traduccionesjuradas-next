import test from "node:test";
import assert from "node:assert/strict";
import { completionBlobPrefix, isOwnBlobUrl, parseCompletionFiles } from "../../lib/q-journey.ts";
import { isAllowedBlobUrl } from "../../lib/pdf-extract.ts";

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

const PRIV = "vercel_blob_rw_PrivZz9_secret";
const PRIV_HOST = "privzz9.private.blob.vercel-storage.com";
const LAVORI_HOST = "wn84khe0mbw27abc.private.blob.vercel-storage.com";

test("acepta nuestra tienda PRIVADA (paso a privado) y no la de lavori", () => {
  assert.equal(isOwnBlobUrl(`https://${PRIV_HOST}/a.pdf`, TOKEN, PRIV), true);
  assert.equal(isOwnBlobUrl(`https://${LAVORI_HOST}/a.pdf`, TOKEN, PRIV), false);
  assert.equal(isOwnBlobUrl(`https://${PRIV_HOST}/a.pdf`, TOKEN, null), false);
  assert.equal(isOwnBlobUrl(`https://${PRIV_HOST}/a.pdf`, undefined, null), false);
});

test("parseCompletionFiles acepta el privado nuestro bajo la carpeta del presupuesto", () => {
  const url = `https://${PRIV_HOST}/${completionBlobPrefix("q1")}a-Xy.pdf`;
  assert.equal(parseCompletionFiles([{ url, name: "a.pdf", size: 5 }], "q1", HOST, PRIV).ok, true);
  assert.equal(parseCompletionFiles([{ url, name: "a.pdf", size: 5 }], "q1", HOST, null).ok, false);
});

test("isAllowedBlobUrl (visor/extract-pages) acepta público y el privado nuestro", () => {
  const prev = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
  process.env.BLOB_PRIVATE_READ_WRITE_TOKEN = PRIV;
  try {
    assert.equal(isAllowedBlobUrl(`https://${HOST}/a.pdf`), true);
    assert.equal(isAllowedBlobUrl(`https://${PRIV_HOST}/a.pdf`), true);
    assert.equal(isAllowedBlobUrl(`https://${LAVORI_HOST}/a.pdf`), false);
    assert.equal(isAllowedBlobUrl("https://evil.example/a.pdf"), false);
  } finally {
    if (prev === undefined) delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN;
    else process.env.BLOB_PRIVATE_READ_WRITE_TOKEN = prev;
  }
});
