import test from "node:test";
import assert from "node:assert/strict";
import { sanearProcedencia } from "../../../lib/entrada/procedencia.ts";

test("hostname only, www stripped, lowercased", () => {
  assert.equal(sanearProcedencia({ referrer: "https://WWW.Google.com/search?q=x" })?.referrer, "google.com");
  assert.equal(sanearProcedencia({ referrer: "chatgpt.com" })?.referrer, "chatgpt.com");
});

test("empty, invalid or own-domain referrer is direct", () => {
  for (const referrer of ["", undefined, 5, "http://", "https://www.traduccionesjuradas.net/blog", "https://sub.traduccionesjuradas.net"]) {
    assert.equal(sanearProcedencia({ referrer })?.referrer, "direct");
  }
});

test("lengths are trimmed and non-strings dropped", () => {
  const p = sanearProcedencia({ referrer: `https://${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.com`, landing: `/${"x".repeat(300)}`, utm_source: "s".repeat(90), utm_medium: 3, utm_campaign: "  " })!;
  assert.ok(p.referrer.length <= 100);
  assert.equal(p.landing?.length, 200);
  assert.equal(p.utm_source?.length, 60);
  assert.equal(p.utm_medium, undefined);
  assert.equal(p.utm_campaign, undefined);
});

test("landing must be a path; non-objects give null", () => {
  assert.equal(sanearProcedencia({ referrer: "", landing: "http://evil" })?.landing, undefined);
  for (const v of [null, "x", 3, [], undefined]) assert.equal(sanearProcedencia(v), null);
});
