import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyTwilioSignature, whatsappLocalEmail, phoneFromWhatsAppAddress } from "../../lib/twilio-signature.ts";

const URL = "https://www.traduccionesjuradas.net/api/whatsapp/inbound";
const TOKEN = "test-auth-token";

function sign(url: string, params: Record<string, string>) {
  const data = Object.keys(params).sort().reduce((acc, k) => acc + k + params[k], url);
  return createHmac("sha1", TOKEN).update(data).digest("base64");
}

test("verifyTwilioSignature acepta la firma correcta y rechaza la alterada", () => {
  const params = { From: "whatsapp:+34600123456", Body: "Hola", MessageSid: "SM123", NumMedia: "0" };
  const sig = sign(URL, params);
  assert.equal(verifyTwilioSignature(URL, params, sig, TOKEN), true);
  assert.equal(verifyTwilioSignature(URL, { ...params, Body: "Hola!" }, sig, TOKEN), false);
  assert.equal(verifyTwilioSignature(URL + "?x=1", params, sig, TOKEN), false);
  assert.equal(verifyTwilioSignature(URL, params, null, TOKEN), false);
  assert.equal(verifyTwilioSignature(URL, params, sig, undefined), false);
});

test("whatsappLocalEmail y phoneFromWhatsAppAddress", () => {
  assert.equal(phoneFromWhatsAppAddress("whatsapp:+34600123456"), "+34600123456");
  assert.equal(whatsappLocalEmail("+34600123456"), "34600123456@whatsapp.local");
});
