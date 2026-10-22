import test from "node:test";
import assert from "node:assert/strict";
import { hasCronSecret } from "../../lib/cron-auth.ts";

const req = (headers: Record<string, string>) => new Request("https://x.test/api/cron", { headers });

test("fails closed when no secret is configured", () => {
  assert.equal(hasCronSecret(req({ authorization: "Bearer undefined" }), undefined), false);
  assert.equal(hasCronSecret(req({ authorization: "Bearer " }), ""), false);
  assert.equal(hasCronSecret(req({}), undefined, null, ""), false);
});

test("accepts Bearer, raw and x-cron-secret", () => {
  assert.equal(hasCronSecret(req({ authorization: "Bearer s3cret" }), "s3cret"), true);
  assert.equal(hasCronSecret(req({ authorization: "s3cret" }), "s3cret"), true);
  assert.equal(hasCronSecret(req({ "x-cron-secret": "s3cret" }), "s3cret"), true);
  assert.equal(hasCronSecret(req({ "x-cron-secret": "Bearer s3cret" }), "s3cret"), true);
});

test("rejects wrong, missing and different-length values", () => {
  assert.equal(hasCronSecret(req({ authorization: "Bearer nope!!" }), "s3cret"), false);
  assert.equal(hasCronSecret(req({ authorization: "Bearer s3cre" }), "s3cret"), false);
  assert.equal(hasCronSecret(req({}), "s3cret"), false);
});

test("any of several configured secrets matches", () => {
  assert.equal(hasCronSecret(req({ authorization: "Bearer b" }), undefined, "a", "b"), true);
});
