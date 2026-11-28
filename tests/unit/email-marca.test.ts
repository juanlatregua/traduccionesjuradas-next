import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ORDER_TOKEN_SECRET = "test-secret-for-unit-tests-32chars!!";

const { emailLayout, emailButton, EMAIL_LOGO_URL, textLinesToHtml, ctaFromLine, stripTextSignature } = await import("../../lib/email-layout.ts");
const { renderSimpleEmailHtml, renderPayLinkEmailHtml, buildPayLinkEmail, buildReminderEmail, payLinkBreakdown, payLinkDecorFromQuote } = await import("../../lib/quote-messages.ts");
const { renderDeliveryEmailHtml, ratingUrls, removeReviewLine } = await import("../../lib/emails/delivery-email.ts");
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

test("firma de la casa: sin el nombre ni el nº de Juan; la cabecera solo lleva el nº con la firma de Juan", () => {
  const html = emailLayout({ content: "x", signature: "house" });
  assert.ok(!html.includes("Juan Silva") && !html.includes("3850"));
  assert.ok(!emailLayout({ content: "x" }).includes("3850"));
  assert.ok(!renderSimpleEmailHtml("Hola").includes("3850"));
  assert.ok(!delivery().includes("3850"), "entrega sin par explícito: firma de la casa");
  assert.ok(delivery({ houseSignature: false }).includes("MÁLAGA · MAEC Nº 3850"));
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
  assert.ok(html.includes("Presupuesto 2026-00431") && html.includes("Dos preguntas para no fallarle") && html.includes("IVA 21 %"));
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
  assert.ok(!html.includes("nos ayuda mucho su valoración"), "las estrellas sustituyen la frase de reseña");
  assert.ok(html.includes('href="https://g.co/r"') && html.includes("o déjenos su opinión directamente en Google"), "Google sigue a mano bajo las estrellas");
  assert.ok(html.includes("/area-cliente?email=marie%40example.com&amp;token="));
});

test("entrega: el cupón solo aparece con referral", () => {
  assert.ok(!delivery().includes("Regale un 10 %"));
  const html = delivery({ referral: { code: "MARIE-2027", shareUrl: "https://www.traduccionesjuradas.net/r/MARIE-2027" } });
  assert.ok(html.includes("Regale un 10 % y gane otro 10 %") && html.includes("Pásele su código") && html.includes("MARIE-2027"));
  assert.ok(html.includes("https://wa.me/?text=") && html.includes(encodeURIComponent("https://www.traduccionesjuradas.net/r/MARIE-2027")));
  assert.ok(html.includes("Código de un solo uso, válido 12 meses. No se suma a otros descuentos."));
});

test("entrega: el texto editado por el staff manda y los bloques de diseño se mantienen", () => {
  const html = delivery({ text: "Hola Marie, aquí la tiene.\n\nJuan", invoiceNumber: "F-2026-000123", lang: "es" });
  assert.ok(html.includes("Hola Marie, aquí la tiene.") && !html.includes("Le adjunto"));
  assert.ok(html.includes("Factura F-2026-000123") && html.includes("¿Qué tal lo hemos hecho?") && html.includes("Su archivo, siempre a mano"));
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

const sumRows = (b: { rows: { amountEur: number }[] }) => Math.round(b.rows.reduce((a, r) => a + r.amountEur, 0) * 100) / 100;

test("desglose: cuadra con descuento, con envío en papel y con plazos", () => {
  // 2 × 35 = 70; −7 de descuento; +12 de envío → base 75; IVA 21 % 15,75; total 90,75.
  const d = payLinkDecorFromQuote({ quoteNumber: "Q1", total: "90.75", vatAmount: "15.75", vatRate: "0.21", discountAmount: "7", shippingAmount: "12", lines: [{ description: "A", lineTotal: "35" }, { description: "B", lineTotal: "35" }] });
  const b = payLinkBreakdown(d)!;
  assert.equal(sumRows(b), 90.75);
  assert.equal(b.quoteTotalEur, 90.75);
  assert.equal(b.payNowEur, null);
  assert.deepEqual(b.rows.map((r) => r.kind), ["line", "line", "discount", "shipping", "vat"]);
  const html = renderPayLinkEmailHtml("Ver y pagar mi presupuesto: https://x.net/q/t", d);
  assert.ok(html.includes("Descuento") && html.includes("Envío en papel"));

  // Plazos: total 60,50 ahora + 30,25 después = 90,75 del presupuesto.
  const p = payLinkBreakdown({ lines: [{ description: "A", amountEur: 50 }], vatEur: 10.5, vatRate: 0.21, totalEur: 60.5, balanceEur: 30.25 })!;
  assert.equal(sumRows(p), 90.75);
  assert.equal(p.quoteTotalEur, 90.75);
  assert.equal(p.payNowEur, 60.5);
  const ph = renderPayLinkEmailHtml("x", { lines: [{ description: "A", amountEur: 50 }], vatEur: 10.5, vatRate: 0.21, totalEur: 60.5, balanceEur: 30.25 });
  assert.ok(ph.includes("Total del presupuesto") && ph.includes("Ahora paga: 60,50") && ph.includes("(primer plazo)") && ph.includes("Segundo plazo"));
});

test("reseña: se va la frase de Google, el resto del párrafo se queda", () => {
  assert.equal(removeReviewLine("Gracias por su confianza.\nSi le ha sido útil, nos ayuda mucho su valoración en Google: https://g.co/r", "https://g.co/r"), "Gracias por su confianza.");
  assert.equal(removeReviewLine("Aquí tiene el enlace https://g.co/r para lo que necesite", "https://g.co/r"), "Aquí tiene el enlace  para lo que necesite");
  const html = delivery({ text: "Hola:\n\nLe adjunto la traducción.\nGracias por su confianza.\nSi le ha sido útil, valórenos en Google: https://g.co/r\n\nUn saludo,\nJuan Silva — TraduccionesJuradas.net" });
  assert.ok(html.includes("Gracias por su confianza."));
});

test("firma: la del texto no sale dos veces con la tarjeta", () => {
  assert.equal(stripTextSignature("Un saludo,\nJuan Silva — TraduccionesJuradas.net"), "Un saludo,");
  assert.equal(stripTextSignature("Quedo a su disposición. – Juan Silva"), "Quedo a su disposición.");
  assert.equal(stripTextSignature("Atentamente, Juan Silva – Traductor Jurado (MAEC)."), "Atentamente,");
  const pay = renderPayLinkEmailHtml(buildPayLinkEmail({ name: "Marie Dupont", payUrl: "https://x.net/q/t", totalEur: 84.7 }).body, { houseSignature: false });
  assert.equal(pay.split("Juan Silva").length - 1, 1);
  assert.equal(delivery({ houseSignature: false }).split("Juan Silva").length - 1, 1);
  assert.ok(!delivery().includes("Juan Silva"), "firma de la casa: sin Juan en el texto");
});

test("tarjeta al compartir: genérica si está pagado, borrado o sustituido", () => {
  const row = { quoteNumber: "2026-00431", status: "SENT", total: 84.7, vatRate: 0.21 };
  assert.ok(quoteShare({ ...row, status: "OPENED" }));
  for (const status of ["PAID", "ACCEPTED", "DRAFT", "DELIVERED", "IN_PROGRESS"]) assert.equal(quoteShare({ ...row, status }), null, status);
  assert.equal(quoteShare({ ...row, deletedAt: new Date() }), null);
  assert.equal(quoteShare({ ...row, supersededAt: new Date() }), null);
});
