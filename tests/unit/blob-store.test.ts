import test from "node:test";
import assert from "node:assert/strict";
import { blobPrivadoOn, fileLink, isOurBlobHost } from "../../lib/blob-store.ts";
import { isOwnStoreUrl } from "../../lib/blob-hosts.ts";

const PUB_TOKEN = "vercel_blob_rw_PubStore1_secret";
const PRIV_TOKEN = "vercel_blob_rw_PrivStore9_secret";
const tokens = { publicToken: PUB_TOKEN, privateToken: PRIV_TOKEN };
const PUB = "https://pubstore1.public.blob.vercel-storage.com/orders/a-Xy.pdf";
const PRIV = "https://privstore9.private.blob.vercel-storage.com/orders/a-Xy.pdf";
const LAVORI = "https://wn84khe0mbw27abc.private.blob.vercel-storage.com/x.pdf";

test("isOurBlobHost acepta el host público y el privado nuestro", () => {
  assert.equal(isOurBlobHost(PUB, tokens), true);
  assert.equal(isOurBlobHost(PRIV, tokens), true);
});

test("isOurBlobHost rechaza hosts ajenos, el privado de otra tienda y basura", () => {
  assert.equal(isOurBlobHost("https://evil.example/a.pdf", tokens), false);
  assert.equal(isOurBlobHost(LAVORI, tokens), false);
  assert.equal(isOurBlobHost(PRIV, { publicToken: PUB_TOKEN }), false, "sin token privado no hay privado nuestro");
  assert.equal(isOurBlobHost("https://public.blob.vercel-storage.com.evil.example/a.pdf", tokens), false);
  assert.equal(isOurBlobHost(PUB.replace("https:", "http:"), tokens), false);
  assert.equal(isOurBlobHost("https://x@pubstore1.public.blob.vercel-storage.com/a.pdf", tokens), false);
  assert.equal(isOurBlobHost("no es url", tokens), false);
  assert.equal(isOurBlobHost(undefined, tokens), false);
});

test("isOwnStoreUrl exige la tienda exacta en público y en privado", () => {
  assert.equal(isOwnStoreUrl(PUB, tokens), true);
  assert.equal(isOwnStoreUrl(PRIV, tokens), true);
  assert.equal(isOwnStoreUrl("https://otra.public.blob.vercel-storage.com/a.pdf", tokens), false);
  assert.equal(isOwnStoreUrl(LAVORI, tokens), false);
});

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    prev[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(prev)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test("blobPrivadoOn: solo con BLOB_PRIVADO=on Y token privado", () => {
  assert.equal(blobPrivadoOn({}), false);
  assert.equal(blobPrivadoOn({ BLOB_PRIVADO: "on" }), false);
  assert.equal(blobPrivadoOn({ BLOB_PRIVADO: "true", BLOB_PRIVATE_READ_WRITE_TOKEN: PRIV_TOKEN }), false);
  assert.equal(blobPrivadoOn({ BLOB_PRIVADO: "on", BLOB_PRIVATE_READ_WRITE_TOKEN: PRIV_TOKEN }), true);
});

test("fileLink apagado devuelve la URL tal cual", () => {
  withEnv({ BLOB_PRIVADO: undefined, BLOB_PRIVATE_READ_WRITE_TOKEN: PRIV_TOKEN }, () => {
    assert.equal(fileLink(PRIV, { kind: "staff" }), PRIV);
    assert.equal(fileLink(PUB, { kind: "client", reference: "R1", token: "t" }), PUB);
  });
});

test("fileLink encendido lleva al proxy con la credencial de la audiencia", () => {
  withEnv({ BLOB_PRIVADO: "on", BLOB_PRIVATE_READ_WRITE_TOKEN: PRIV_TOKEN }, () => {
    assert.equal(fileLink(PRIV, { kind: "staff" }), "/api/files/orders/a-Xy.pdf");
    assert.equal(fileLink(PRIV, { kind: "client", reference: "R1", token: "tk" }), "/api/files/orders/a-Xy.pdf?ref=R1&t=tk");
    assert.equal(fileLink(PRIV, { kind: "collaborator", token: "as" }, { download: true }), "/api/files/orders/a-Xy.pdf?a=as&download=1");
    assert.equal(fileLink(PRIV, { kind: "quote", token: "qq" }, { base: "https://x.test" }), "https://x.test/api/files/orders/a-Xy.pdf?q=qq");
    assert.equal(fileLink(PUB, { kind: "staff" }), PUB, "un blob público viejo sigue con su URL");
  });
});
