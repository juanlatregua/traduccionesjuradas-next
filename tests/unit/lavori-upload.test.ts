import test from "node:test";
import assert from "node:assert/strict";
import { isLavoriUploadPathFor, lavoriUploadPathname } from "../../lib/lavori-upload.ts";
import { isTranslatorFile } from "../../lib/delivery-files.ts";

test("la ruta de subida de una entrega queda bajo /entregas-lavori/ (nunca visible al cliente sin revisar)", () => {
  const p = lavoriUploadPathname("26_3D3B0C", "entrega", "TRADUCCIÓN Y ORIGINAL - ESCRITURA CUOTAS.pdf", 1793992739964);
  assert.equal(p, "lavori-subidas/26_3D3B0C/entregas-lavori/1793992739964-TRADUCCION Y ORIGINAL - ESCRITURA CUOTAS.pdf");
  assert.equal(isTranslatorFile(`https://x.public.blob.vercel-storage.com/${p}`, new Set()), true);
});

test("el blob solo vale para su motorRef y su tipo", () => {
  const p = lavoriUploadPathname("26_3D3B0C", "entrega", "a.pdf");
  assert.equal(isLavoriUploadPathFor(p, "26_3D3B0C", "entrega"), true);
  assert.equal(isLavoriUploadPathFor(p, "26_FC08A5", "entrega"), false);
  assert.equal(isLavoriUploadPathFor(p, "26_3D3B0C", "factura"), false);
  assert.equal(isLavoriUploadPathFor("orders/26_3D3B0C/entregas-lavori/a.pdf", "26_3D3B0C", "entrega"), false);
});

test("motorRef con caracteres raros no escapa del prefijo", () => {
  const p = lavoriUploadPathname("../../orders/X", "factura", "f.pdf");
  assert.ok(p.startsWith("lavori-subidas/_orders_X/facturas-lavori/"));
});

test("URL firmada: solo https y exactamente el Blob privado de lavori (anti-SSRF)", async () => {
  const { isLavoriSignedUrl } = await import("../../lib/lavori-upload.ts");
  assert.equal(isLavoriSignedUrl("https://wn84khe0mbw27abc.private.blob.vercel-storage.com/a.pdf?sig=x"), true);
  assert.equal(isLavoriSignedUrl("http://wn84khe0mbw27abc.private.blob.vercel-storage.com/a.pdf"), false);
  assert.equal(isLavoriSignedUrl("https://wn84khe0mbw27abc.private.blob.vercel-storage.com.evil.com/a.pdf"), false);
  assert.equal(isLavoriSignedUrl("https://otro.private.blob.vercel-storage.com/a.pdf"), false);
  assert.equal(isLavoriSignedUrl("https://169.254.169.254/latest"), false);
  assert.equal(isLavoriSignedUrl(undefined), false);
});
