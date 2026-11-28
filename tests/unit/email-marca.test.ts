import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ORDER_TOKEN_SECRET = "test-secret-for-unit-tests-32chars!!";

const { emailLayout, emailButton, EMAIL_LOGO_URL, textLinesToHtml, ctaFromLine } = await import("../../lib/email-layout.ts");
const { renderSimpleEmailHtml, renderPayLinkEmailHtml, buildPayLinkEmail, buildReminderEmail } = await import("../../lib/quote-messages.ts");
const { renderDeliveryEmailHtml, ratingUrls } = await import("../../lib/emails/delivery-email.ts");
const { verifyOrderToken } = await import("../../lib/order-token.ts");
const { openTracking, isLinkPreviewBot } = await import("../../lib/cierre-math.ts");
const { quoteShare, quoteShareText } = await import("../../lib/q-share.ts");

const delivery = (extra: Record<string, unknown> = {}) =>
  renderDeliveryEmailHtml({
    lang: "es",
    reference: "2026-00431",
    text: "Buenos días, Marie:\n\nLe adjunto la traducción jurada del pedido 2026-00431.\n\nSi le ha sido útil, nos ayuda mucho su valoración en Google: https://g.co/r\n\nUn saludo,\nJuan Silva — TraduccionesJuradas.net",
    clientName: "Marie",
    reviewUrl: "https://g.co/r",
    clientEmail: "marie@example.com",
    ...extra,
  });

test("la envoltura lleva el logo PNG con URL absoluta y ningún SVG", () => {
  const html = emailLayout({ content: "<p>Hola</p>" });
  assert.equal(EMAIL_LOGO_URL, "https://www.traduccionesjuradas.net/brand/logo-email.png");
  assert.ok(html.includes(`src="${EMAIL_LOGO_URL}"`));
  assert.ok(!/\.svg|<svg/i.test(html));
  const simple = renderSimpleEmailHtml("Hola");
  assert.ok(simple.includes(EMAIL_LOGO_URL) && !simple.includes(".svg"));
});

test("firma de la casa: sin el nombre ni el nº de Juan", () => {
  const html = emailLayout({ content: "x", signature: "house" });
  assert.ok(!html.includes("Juan Silva") && !html.includes("3850"));
  assert.ok(emailLayout({ content: "x", signature: "juan" }).includes("MAEC nº 3850"));
});

test("el botón lleva la URL (y escapa &)", () => {
  const url = "https://www.traduccionesjuradas.net/q/abc?pago=tarjeta&x=1";
  const html = emailButton("Ver y pagar mi presupuesto", url);
  assert.ok(html.includes('href="https://www.traduccionesjuradas.net/q/abc?pago=tarjeta&amp;x=1"'));
  assert.ok(html.includes(">Ver y pagar mi presupuesto</a>"));
});

test("presupuesto: la línea «etiqueta: URL» es un botón y el texto plano sigue con la URL", () => {
  const payUrl = "https://www.traduccionesjuradas.net/q/tok123";
  const { body } = buildPayLinkEmail({ name: "Marie Dupont", payUrl, totalEur: 84.7 });
  assert.ok(body.includes(`Ver y pagar mi presupuesto: ${payUrl}`));
  const html = renderPayLinkEmailHtml(body, { quoteNumber: "2026-00431", lines: [{ description: "Extracto", amountEur: 70 }], vatRate: 0.21, vatEur: 14.7, totalEur: 84.7 });
  assert.ok(html.includes(`href="${payUrl}"`));
  assert.ok(!html.includes(`>${payUrl}<`), "la URL no queda a la vista");
  assert.ok(html.includes("Presupuesto 2026-00431") && html.includes("Dos preguntas para no fallarte") && html.includes("IVA 21 %"));
  assert.ok(html.indexOf("Extracto") < html.indexOf(`href="${payUrl}"`), "el desglose va antes del botón");
});

test("recordatorio: botón al presupuesto; los enlaces de motivo (?fb=) no son botones", () => {
  const r = buildReminderEmail({ name: "Marie Dupont", quoteNumber: "2026-00431", sentDate: new Date("2026-11-20"), payUrl: "https://x.net/q/t" });
  assert.ok(r.body.includes("https://x.net/q/t"));
  assert.ok(textLinesToHtml(r.body).includes('href="https://x.net/q/t"'));
  assert.equal(ctaFromLine("· El precio: https://x.net/q/t?fb=PRICE"), null);
});

test("entrega: 5 estrellas con r=1..5 y un token que verifyOrderToken acepta", () => {
  const html = delivery();
  for (let r = 1; r <= 5; r++) assert.ok(new RegExp(`/opinion/2026-00431\\?t=[^&"]+&amp;r=${r}"`).test(html), `falta r=${r}`);
  const t = decodeURIComponent(/\/opinion\/2026-00431\?t=([^&"]+)&amp;r=1/.exec(html)![1]);
  assert.equal(verifyOrderToken("2026-00431", t), true);
  assert.equal(ratingUrls("R", "tok")[4], "https://www.traduccionesjuradas.net/opinion/R?t=tok&r=5");
  assert.ok(!html.includes("https://g.co/r"), "las estrellas sustituyen la línea de reseña");
  assert.ok(html.includes("/area-cliente?email=marie%40example.com&amp;token="));
});

test("entrega: el cupón solo aparece con referral", () => {
  assert.ok(!delivery().includes("Regala un 10 %"));
  const html = delivery({ referral: { code: "MARIE-2027", shareUrl: "https://www.traduccionesjuradas.net/r/MARIE-2027" } });
  assert.ok(html.includes("Regala un 10 % y gana otro 10 %") && html.includes("MARIE-2027"));
  assert.ok(html.includes("https://wa.me/?text=") && html.includes(encodeURIComponent("https://www.traduccionesjuradas.net/r/MARIE-2027")));
  assert.ok(html.includes("Código de un solo uso, válido 12 meses. No se suma a otros descuentos."));
});

test("entrega: el texto editado por el staff manda y los bloques de diseño se mantienen", () => {
  const html = delivery({ text: "Hola Marie, aquí la tiene.\n\nJuan", invoiceNumber: "F-2026-000123", lang: "es" });
  assert.ok(html.includes("Hola Marie, aquí la tiene.") && !html.includes("Le adjunto"));
  assert.ok(html.includes("Factura F-2026-000123") && html.includes("¿Qué tal lo hemos hecho?") && html.includes("Tu archivo, siempre a mano"));
  assert.ok(delivery({ lang: "fr" }).includes("Comment l'avons-nous fait ?"));
});

test("un rastreador de vistas previas no marca abierto ni cuenta apertura", () => {
  for (const ua of [
    "WhatsApp/2.23.20.0 A",
    "facebookexternalhit/1.1 Facebot Twitterbot/1.0",
    "TelegramBot (like TwitterBot)",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "LinkedInBot/1.0",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  ]) {
    assert.equal(isLinkPreviewBot(ua), true, ua);
    assert.deepEqual(openTracking(ua, "SENT"), { record: false, markOpened: false });
  }
  const human = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
  assert.deepEqual(openTracking(human, "SENT"), { record: true, markOpened: true });
  assert.deepEqual(openTracking(human, "PAID"), { record: true, markOpened: false });
});

test("tarjeta al compartir: número y total, genérica si caduca o no existe", () => {
  const row = { quoteNumber: "2026-00431", status: "SENT", total: 84.7, vatRate: 0.21, pdfLang: "es" };
  assert.equal(quoteShareText(quoteShare(row)).title, "Tu presupuesto 2026-00431 · 84,70\u00a0€");
  assert.equal(quoteShare({ ...row, status: "EXPIRED" }), null);
  assert.equal(quoteShare({ ...row, tokenExpiresAt: new Date("2020-01-01") }), null);
  assert.equal(quoteShareText(null).title, "Traducciones Juradas");
});
