import test from "node:test";
import assert from "node:assert/strict";
import { replyLink } from "../../lib/respuesta-guard.ts";

const base = "https://www.traduccionesjuradas.net";

test("InboundEmail gana: enlace a la bandeja con ?id=", () => {
  const r = replyLink({ baseUrl: base, quoteId: "q1", evidence: { inboxEmailId: "abc", webLink: "https://outlook/x" } });
  assert.equal(r.url, `${base}/admin/inbox?id=abc`);
  assert.equal(r.quoteUrl, `${base}/zona-traductor/presupuestos/q1`);
  assert.equal(r.isMessage, true);
});

test("sin InboundEmail: webLink de Outlook", () => {
  const r = replyLink({ baseUrl: base, quoteId: "q1", evidence: { webLink: "https://outlook/x" } });
  assert.equal(r.url, "https://outlook/x");
  assert.equal(r.isMessage, true);
});

test("sin evidencia: presupuesto", () => {
  for (const evidence of [undefined, null, {}]) {
    const r = replyLink({ baseUrl: base, quoteId: "q1", evidence });
    assert.equal(r.url, r.quoteUrl);
    assert.equal(r.isMessage, false);
  }
});
