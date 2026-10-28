import test from "node:test";
import assert from "node:assert/strict";
import { createResumeToken, verifyResumeToken, RESUME_TOKEN_TTL_MS } from "../../lib/puerta-resume-token.ts";

test("ida y vuelta: devuelve sesión y documento", () => {
  const t = createResumeToken("k", "sess-1", "doc-1", 1000);
  assert.deepEqual(verifyResumeToken("k", t, 2000), { sessionToken: "sess-1", documentId: "doc-1" });
});

test("rechaza otra clave, firma tocada y caducado", () => {
  const t = createResumeToken("k", "sess-1", "doc-1", 1000);
  assert.equal(verifyResumeToken("otra", t, 2000), null);
  const [b64] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ s: "sess-2", d: "doc-9", exp: 9e15 })).toString("base64url");
  assert.equal(verifyResumeToken("k", `${forged}.${t.split(".")[1]}`, 2000), null);
  assert.equal(verifyResumeToken("k", `${b64}.`, 2000), null);
  assert.equal(verifyResumeToken("k", t, 1000 + RESUME_TOKEN_TTL_MS + 1), null);
  assert.equal(verifyResumeToken("k", null), null);
});

test("no vale como token de «revisar a mano» ni al revés (prefijo distinto)", async () => {
  const { createReviewToken } = await import("../../lib/lead-nudge.ts");
  const review = createReviewToken("k", "sess-1", "es", 1000);
  assert.equal(verifyResumeToken("k", review, 2000), null);
});
