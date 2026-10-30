import test from "node:test";
import assert from "node:assert/strict";
import { buildPayLinkEmail, buildWhatsAppPayText } from "../../lib/quote-messages.ts";
import { appendDownloadLinks, buildDeliveryText, buildDeliveryWhatsappText, deliveryTextToHtml } from "../../lib/delivery-message.ts";

const URL = "https://valide.redsara.es";
// En el presupuesto va sin https: la unica llamada a la accion es el enlace de pago.
const DOMINIO = "valide.redsara.es";
const base = { name: "Marta", payUrl: "https://www.traduccionesjuradas.net/q/abc123", totalEur: 90, deliveryTerm: "2 días" };
const entrega = { name: "Ana", reference: "R1", reviewUrl: "https://g.co/r" };

test("presupuesto digital: frase de seguridad en todos los idiomas, email y WhatsApp", () => {
  for (const lang of ["es", "en", "fr", "pt", "it", "de"]) {
    assert.ok(buildPayLinkEmail({ ...base, lang }).body.includes(DOMINIO), lang);
    assert.ok(buildWhatsAppPayText({ ...base, lang }).includes(DOMINIO), lang);
  }
});

test("presupuesto en papel: sin frase de firma electronica", () => {
  const data = { ...base, deliveryType: "PAPER_SHIP" as const };
  assert.ok(!buildPayLinkEmail(data).body.includes(DOMINIO));
  assert.ok(!buildWhatsAppPayText(data).includes(DOMINIO));
});

test("entrega: frase en es, fr y en, tambien en WhatsApp y en la version corregida", () => {
  for (const lang of ["es", "fr", "en"] as const) {
    assert.ok(buildDeliveryText({ ...entrega, lang }).includes(URL), lang);
    assert.ok(buildDeliveryText({ ...entrega, lang, correction: true }).includes(URL), lang);
    assert.ok(buildDeliveryWhatsappText({ ...entrega, lang, files: [{ name: "a", url: "https://x.y/a" }] }).includes(URL), lang);
  }
});

test("el enlace del correo es limpio y las descargas siguen antes de la resena", () => {
  const t = buildDeliveryText({ ...entrega, lang: "es" });
  assert.ok(deliveryTextToHtml(t).includes(`<a href="${URL}">${URL}</a>`));
  const conEnlace = appendDownloadLinks(t, "es", ["https://x.y/f"]);
  assert.ok(conEnlace.indexOf("https://x.y/f") < conEnlace.indexOf(entrega.reviewUrl));
  assert.ok(conEnlace.indexOf(URL) < conEnlace.indexOf("https://x.y/f"));
});
