import test from "node:test";
import assert from "node:assert/strict";
import { authorizeFile, blobUrlFromProxyPath, type FileProxyDeps } from "../../lib/file-proxy-auth.ts";

const URL_A = "https://priv.private.blob.vercel-storage.com/orders/R1/documentos/a.pdf";
const URL_B = "https://priv.private.blob.vercel-storage.com/orders/R2/documentos/b.pdf";
const NOW = new Date("2026-11-28T10:00:00Z");

// Pedido R1 → o1 tiene URL_A; pedido R2 → o2 tiene URL_B. Presupuesto qt1 → URL_A.
function deps(over: Partial<FileProxyDeps> = {}): FileProxyDeps {
  const owns: Record<string, string> = { o1: URL_A, o2: URL_B };
  return {
    isStaff: async () => false,
    verifyOrderToken: (ref, t) => t === `tok-${ref}`,
    findOrderId: async (ref) => ({ R1: "o1", R2: "o2" } as Record<string, string>)[ref] ?? null,
    findAssignment: async (tk) =>
      tk === "asg1" ? { orderId: "o1", status: "ACCEPTED", updatedAt: NOW, deliveredFileUrl: null } : null,
    findQuote: async (tk) => (tk === "qt1" ? { id: "q1", tokenExpiresAt: null, deletedAt: null } : null),
    orderHasBlob: async (orderId, url) => owns[orderId] === url,
    quoteHasBlob: async (quoteId, url) => quoteId === "q1" && url === URL_A,
    blobIsKnown: async (url) => url === URL_A || url === URL_B,
    ...over,
  };
}
const p = (q: string) => new URLSearchParams(q);

test("401 sin credencial ni sesión de staff", async () => {
  assert.deepEqual(await authorizeFile(URL_A, p(""), deps(), NOW), { ok: false, status: 401 });
});

test("403 con token de pedido inválido o incompleto", async () => {
  assert.deepEqual(await authorizeFile(URL_A, p("ref=R1&t=malo"), deps(), NOW), { ok: false, status: 403 });
  assert.deepEqual(await authorizeFile(URL_A, p("ref=R1"), deps(), NOW), { ok: false, status: 403 });
  assert.deepEqual(await authorizeFile(URL_A, p("a=nope"), deps(), NOW), { ok: false, status: 403 });
  assert.deepEqual(await authorizeFile(URL_A, p("q=nope"), deps(), NOW), { ok: false, status: 403 });
});

test("403 con token ajeno: credencial válida de OTRO pedido o presupuesto", async () => {
  assert.deepEqual(await authorizeFile(URL_A, p("ref=R2&t=tok-R2"), deps(), NOW), { ok: false, status: 403 });
  assert.deepEqual(await authorizeFile(URL_B, p("a=asg1"), deps(), NOW), { ok: false, status: 403 });
  assert.deepEqual(await authorizeFile(URL_B, p("q=qt1"), deps(), NOW), { ok: false, status: 403 });
});

test("403 si el staff pide una ruta que la BD no conoce", async () => {
  const d = deps({ isStaff: async () => true });
  assert.deepEqual(await authorizeFile("https://priv.private.blob.vercel-storage.com/x.pdf", p(""), d, NOW), { ok: false, status: 403 });
});

test("403 con enlaces caducados (presupuesto y encargo cerrado hace >30 días)", async () => {
  const expired = deps({ findQuote: async () => ({ id: "q1", tokenExpiresAt: new Date("2026-11-01"), deletedAt: null }) });
  assert.deepEqual(await authorizeFile(URL_A, p("q=qt1"), expired, NOW), { ok: false, status: 403 });
  const old = deps({
    findAssignment: async () => ({ orderId: "o1", status: "DELIVERED", updatedAt: new Date("2026-09-01"), deliveredFileUrl: null }),
  });
  assert.deepEqual(await authorizeFile(URL_A, p("a=asg1"), old, NOW), { ok: false, status: 403 });
});

test("200 para cada audiencia con lo suyo", async () => {
  assert.deepEqual(await authorizeFile(URL_A, p("ref=R1&t=tok-R1"), deps(), NOW), { ok: true, via: "client" });
  assert.deepEqual(await authorizeFile(URL_A, p("a=asg1"), deps(), NOW), { ok: true, via: "collaborator" });
  assert.deepEqual(await authorizeFile(URL_A, p("q=qt1"), deps(), NOW), { ok: true, via: "quote" });
  assert.deepEqual(await authorizeFile(URL_B, p(""), deps({ isStaff: async () => true }), NOW), { ok: true, via: "staff" });
});

test("la ruta del proxy no admite saltos ni rutas vacías", () => {
  const host = "priv.private.blob.vercel-storage.com";
  assert.equal(blobUrlFromProxyPath("orders/R1/a%20b.pdf", host), `https://${host}/orders/R1/a%20b.pdf`);
  assert.equal(blobUrlFromProxyPath("orders/../x.pdf", host), null);
  assert.equal(blobUrlFromProxyPath("orders/%2e%2e/x.pdf", host), null);
  assert.equal(blobUrlFromProxyPath("orders//x.pdf", host), null);
  assert.equal(blobUrlFromProxyPath("orders/a%2Fb.pdf", host), null);
  assert.equal(blobUrlFromProxyPath("orders/%E0%A4%A.pdf", host), null);
  assert.equal(blobUrlFromProxyPath("", host), null);
  assert.equal(blobUrlFromProxyPath("a.pdf", null), null);
});
