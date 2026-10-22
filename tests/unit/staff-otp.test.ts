import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPendingOtpToken,
  createVerifiedOtpToken,
  isPendingOtpCodeValid,
  readPendingOtpToken,
  readVerifiedOtpToken,
} from "../../lib/staff-otp.ts";

process.env.NEXTAUTH_SECRET = "test-secret";

test("la cookie pendiente no lleva el código en claro", () => {
  const token = createPendingOtpToken("hola@traduccionesjuradas.net", "123456", 60_000);
  const json = Buffer.from(token.split(".")[0], "base64url").toString("utf8");
  assert.ok(!json.includes("123456"));
  const pending = readPendingOtpToken(token)!;
  assert.equal(isPendingOtpCodeValid(pending, "123456"), true);
  assert.equal(isPendingOtpCodeValid(pending, "654321"), false);
});

test("un token pendiente no vale como verificado", () => {
  const pending = createPendingOtpToken("hola@traduccionesjuradas.net", "123456", 60_000);
  assert.equal(readVerifiedOtpToken(pending), null);
  const verified = createVerifiedOtpToken("hola@traduccionesjuradas.net", 60_000);
  assert.equal(readVerifiedOtpToken(verified)?.email, "hola@traduccionesjuradas.net");
  assert.equal(readPendingOtpToken(verified), null);
});

test("firma alterada se rechaza", () => {
  const verified = createVerifiedOtpToken("hola@traduccionesjuradas.net", 60_000);
  const [p] = verified.split(".");
  assert.equal(readVerifiedOtpToken(`${p}.AAAA`), null);
});
