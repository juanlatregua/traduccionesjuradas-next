import test from "node:test";
import assert from "node:assert/strict";
import { buildPayLinkEmail, buildWhatsAppPayText, cardPayUrl } from "../../lib/quote-messages.ts";

const base = {
  name: "Marta",
  payUrl: "https://www.traduccionesjuradas.net/q/abc123",
  proofUrl: "https://www.traduccionesjuradas.net/q/abc123?paso=justificante",
};

test("enlace de tarjeta solo para /q/ y respetando la query", () => {
  assert.equal(cardPayUrl(base.payUrl), `${base.payUrl}?pago=tarjeta`);
  assert.equal(cardPayUrl(`${base.payUrl}?x=1`), `${base.payUrl}?x=1&pago=tarjeta`);
  assert.equal(cardPayUrl("https://www.traduccionesjuradas.net/pedido/2026-1?t=firma"), null);
  assert.equal(cardPayUrl("no es url"), null);
});

test("email del presupuesto: corto, en usted, con tarjeta", () => {
  const { body } = buildPayLinkEmail({ ...base, translatorName: "Ana Ruiz", translatorMaec: "1234", paymentMethods: ["sabadell"] });
  assert.match(body, /^Estimado\/a Marta:\n\nLe enviamos el presupuesto de su traducción jurada \(lo realiza Ana Ruiz, traductor\/a-intérprete jurado\/a nº 1234\)\./);
  assert.match(body, /Pagar con tarjeta: https:\/\/www\.traduccionesjuradas\.net\/q\/abc123\?pago=tarjeta\nVer el presupuesto: https:\/\/www\.traduccionesjuradas\.net\/q\/abc123\n/);
  assert.match(body, /También puede pagar:\n1\. por transferencia a Banco Sabadell/);
  assert.match(body, /adjunte el justificante aquí/);
  assert.match(body, /Un saludo,\nJuan Silva — TraduccionesJuradas\.net$/);
  assert.doesNotMatch(body, /escanear|tu idioma|12 €/);
});

test("el envío en papel solo sale en PAPER_SHIP", () => {
  assert.match(buildPayLinkEmail({ ...base, deliveryType: "PAPER_SHIP" }).body, /envío en papel cuesta 12 € \+ IVA/);
  assert.doesNotMatch(buildPayLinkEmail({ ...base, deliveryType: "DIGITAL_PDF" }).body, /papel/);
});

test("enlace de pedido (no /q/): sin línea de tarjeta", () => {
  const { body } = buildPayLinkEmail({ ...base, payUrl: "https://www.traduccionesjuradas.net/pedido/2026-1?t=firma" });
  assert.doesNotMatch(body, /tarjeta/);
  assert.match(body, /Puede pagar:/);
});

test("WhatsApp: línea de tarjeta si es /q/", () => {
  assert.match(buildWhatsAppPayText({ name: "Marta", payUrl: base.payUrl }), /Pagar con tarjeta: .*\?pago=tarjeta/);
  assert.doesNotMatch(buildWhatsAppPayText({ name: "Marta", payUrl: "https://x.es/pedido/1" }), /tarjeta/);
});
