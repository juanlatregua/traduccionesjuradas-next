import test from "node:test";
import assert from "node:assert/strict";
import { buildPayLinkEmail, buildWhatsAppPayText, buildPaidDigitalEmail, buildPaidPaperEmail, cardPayUrl } from "../../lib/quote-messages.ts";

const base = {
  name: "Marta",
  payUrl: "https://www.traduccionesjuradas.net/q/abc123",
  totalEur: 90,
  deliveryTerm: "2-3 días hábiles",
};

test("enlace de tarjeta solo para /q/ y respetando la query", () => {
  assert.equal(cardPayUrl(base.payUrl), `${base.payUrl}?pago=tarjeta`);
  assert.equal(cardPayUrl(`${base.payUrl}?x=1`), `${base.payUrl}?x=1&pago=tarjeta`);
  assert.equal(cardPayUrl("https://www.traduccionesjuradas.net/pedido/2026-1?t=firma"), null);
  assert.equal(cardPayUrl("no es url"), null);
});

test("email del presupuesto: total, entrega y enlace en las 3 primeras líneas", () => {
  const { body } = buildPayLinkEmail({ ...base, translatorName: "Ana Ruiz", translatorMaec: "1234" });
  const [l1, l2, l3] = body.split("\n");
  assert.equal(l1, "Estimado/a Marta:");
  assert.match(l2, /^Total 90,00\s€ \(IVA incl\.\) · Entrega: 2-3 días hábiles$/);
  assert.equal(l3, `Ver el presupuesto y pagar: ${base.payUrl}`);
  assert.match(body, /La traducción la realiza Ana Ruiz, traductor\/a-intérprete jurado\/a nº 1234 del MAEC\./);
  assert.match(body, /Juan Silva — TraduccionesJuradas\.net$/);
});

test("una sola llamada a la acción: sin métodos de pago ni justificante", () => {
  const { body } = buildPayLinkEmail(base);
  assert.equal(body.match(/https?:\/\//g)?.length, 1);
  assert.doesNotMatch(body, /Sabadell|Bizum|IBAN|justificante|tarjeta/i);
});

test("sin plazo en el presupuesto no se inventa la entrega; papel solo en PAPER_SHIP", () => {
  const noTerm = buildPayLinkEmail({ ...base, deliveryTerm: null }).body;
  assert.match(noTerm.split("\n")[1], /^Total 90,00\s€ \(IVA incl\.\)$/);
  assert.doesNotMatch(noTerm, /Entrega|días hábiles/);
  assert.doesNotMatch(buildWhatsAppPayText({ ...base, deliveryTerm: null }), /Entrega|días hábiles/);
  const paper = buildPayLinkEmail({ ...base, deliveryType: "PAPER_SHIP" }).body;
  assert.match(paper, /envío en papel \(12 € \+ IVA\)/);
  assert.doesNotMatch(buildPayLinkEmail({ ...base, deliveryType: "DIGITAL_PDF" }).body, /papel/);
});

test("dos plazos: «Primer pago» y el segundo en la línea del resumen", () => {
  const line = buildPayLinkEmail({ ...base, totalEur: 40, balanceEur: 60 }).body.split("\n")[1];
  assert.match(line, /^Primer pago 40,00\s€ \(IVA incl\.\) · Segundo pago 60,00\s€ · Entrega: 2-3 días hábiles$/);
});

test("el jurado lleva «del MAEC» y el WhatsApp el par de idiomas", () => {
  assert.match(buildPayLinkEmail({ ...base, translatorName: "Ana", translatorMaec: "1234" }).body, /nº 1234 del MAEC\./);
  assert.match(buildWhatsAppPayText({ ...base, sourceLang: "fr", targetLang: "es" }), /francés → español/);
});

test("no residente UE: no dice IVA incluido", () => {
  assert.doesNotMatch(buildPayLinkEmail({ ...base, vatExempt: true }).body, /IVA incl/);
});

test("idioma del cliente: inglés, y los desconocidos caen a inglés", () => {
  const en = buildPayLinkEmail({ ...base, lang: "en", deliveryTerm: "2 business days" });
  assert.equal(en.subject, "Your sworn translation quote");
  assert.match(en.body, /Total .*90\.00.* \(VAT incl\.\) · Delivery: 2 business days/);
  assert.match(buildPayLinkEmail({ ...base, lang: "ru" }).body, /\(VAT incl\.\)/);
  assert.match(buildPayLinkEmail({ ...base, lang: "fr" }).body, /^Bonjour Marta,/);
});

test("WhatsApp: saludo, total·entrega y un solo enlace", () => {
  const text = buildWhatsAppPayText({ ...base, translatorName: "Ana Ruiz" });
  const lines = text.split("\n");
  assert.equal(lines[0], "Hola Marta 👋");
  assert.match(lines[1], /Total 90,00\s€ \(IVA incl\.\) · Entrega: 2-3 días hábiles/);
  assert.equal(lines[2], `Ver el presupuesto y pagar: ${base.payUrl}`);
  assert.equal(text.match(/https?:\/\//g)?.length, 1);
});

test("email de pago recibido: referencia, fecha, seguimiento y contacto, en el idioma", () => {
  const etaDate = new Date("2026-10-14T10:00:00Z");
  const es = buildPaidDigitalEmail({ name: "Marta", etaDate, quoteNumber: "P-2026-0042", trackUrl: base.payUrl });
  assert.match(es.body, /Referencia: P-2026-0042/);
  assert.match(es.body, /Fecha estimada de entrega: 14 de octubre de 2026/);
  assert.match(es.body, /Siga su pedido aquí: https:\/\/www\.traduccionesjuradas\.net\/q\/abc123/);
  assert.match(es.body, /hola@traduccionesjuradas\.net/);
  const fr = buildPaidPaperEmail({ name: "Luc", etaDate, quoteNumber: "P-1", lang: "fr" });
  assert.match(fr.subject, /Paiement reçu/);
  assert.match(fr.body, /Date de livraison estimée: 14 octobre 2026/);
  assert.match(fr.body, /24\/48 h/);
});
