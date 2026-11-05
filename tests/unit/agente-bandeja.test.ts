import test from "node:test";
import assert from "node:assert/strict";

process.env.ORDER_TOKEN_SECRET = process.env.ORDER_TOKEN_SECRET || "test-secret";
import {
  agenteBandejaMode,
  bandejaAction,
  buildNoDocDraft,
  buildQuoteReply,
  checkSegments,
  greetingName,
  isHouseAddress,
  looksAutomated,
  looksLikeVendorPitch,
  looksLikePaymentOrInvoice,
  splitOrRepeatedReason,
  TARIFARIO_AUTOSEND_OFF,
  mentionsDeadline,
  priceFrSegments,
  replyLang,
  segmentPair,
  FR_DELIVERY_TERM,
  MAX_DOCS,
  type Segment,
} from "../../lib/agente-bandeja-math.ts";
import { decideAutoSend, type AutoSendInput } from "../../lib/cierre-math.ts";

const seg = (o: Partial<Segment> = {}): Segment => ({
  fileName: "bulletin.pdf",
  specificType: "criminal_record",
  labelEs: "certificado de antecedentes penales",
  labelFr: "bulletin n°3 du casier judiciaire",
  category: "civil",
  sourceLang: "fr",
  targetLang: "es",
  pages: 1,
  words: 250,
  hasTables: false,
  hasApostille: false,
  apostilleSeparatePage: false,
  confidence: 0.95,
  legible: true,
  risky: false,
  riskReasons: [],
  ...o,
});

test("modo: solo draft/on encienden; cualquier otro valor es off", () => {
  assert.equal(agenteBandejaMode(undefined), "off");
  assert.equal(agenteBandejaMode("ON"), "on");
  assert.equal(agenteBandejaMode(" draft "), "draft");
  assert.equal(agenteBandejaMode("true"), "off");
});

test("buzones de la casa no son leads", () => {
  assert.equal(isHouseAddress("hola@traduccionesjuradas.net"), true);
  assert.equal(isHouseAddress("daniela@lavori.es"), true);
  assert.equal(isHouseAddress("cliente@gmail.com"), false);
});

test("correo masivo o automático no es un lead", () => {
  assert.equal(looksAutomated({ fromEmail: "newsletter@tienda.com", subject: "Ofertas" }), true);
  assert.equal(looksAutomated({ fromEmail: "ana@gmail.com", body: "Si no quiere recibir más correos, darse de baja aquí" }), true);
  assert.equal(looksAutomated({ fromEmail: "ana@gmail.com", subject: "Traducción", body: "Hola, adjunto mi acta" }), false);
});

test("idioma de la respuesta: fr/en si está claro, si no español", () => {
  assert.equal(replyLang("Bonjour, je voudrais un devis pour la traduction de mon casier judiciaire. Merci"), "fr");
  assert.equal(replyLang("Hello, I need a quote for the translation of my birth certificate, thanks"), "en");
  assert.equal(replyLang("Hola, necesito traducir un documento, gracias"), "es");
  assert.equal(replyLang(""), "es");
});

test("plazo: detecta fecha o urgencia", () => {
  assert.equal(mentionsDeadline("Lo necesito para el 15/11"), true);
  assert.equal(mentionsDeadline("Es urgente, tengo cita el lunes"), true);
  assert.equal(mentionsDeadline("J'en ai besoin avant le 20 novembre"), true);
  assert.equal(mentionsDeadline("I need it by Friday"), true);
  assert.equal(mentionsDeadline("Hola, ¿cuánto cuesta traducir mi certificado?"), false);
});

test("saludo: nombre de pila o nada", () => {
  assert.equal(greetingName("MARIE Dupont"), "Marie");
  assert.equal(greetingName("info@empresa.com"), null);
  assert.equal(greetingName(null), null);
});

test("par: español en un lado, nada cruzado ni desconocido", () => {
  assert.equal(segmentPair({ sourceLang: "fr", targetLang: "unknown" }), "fr>es");
  assert.equal(segmentPair({ sourceLang: "es", targetLang: "fr" }), "es>fr");
  assert.equal(segmentPair({ sourceLang: "es", targetLang: "unknown" }), null);
  assert.equal(segmentPair({ sourceLang: "fr", targetLang: "en" }), null);
  assert.equal(segmentPair({ sourceLang: "unknown", targetLang: "es" }), null);
});

test("checkSegments: carril FR, tarifario y todos los frenos", () => {
  assert.deepEqual(checkSegments([seg()]), { ok: true, pair: "fr>es", lane: "fr" });
  assert.deepEqual(checkSegments([seg({ sourceLang: "pt" })]), { ok: true, pair: "pt>es", lane: "tarifario" });
  assert.equal(checkSegments([]).ok, false);
  assert.equal(checkSegments(Array.from({ length: MAX_DOCS + 1 }, () => seg())).ok, false);
  assert.equal(checkSegments([seg({ risky: true, riskReasons: ["oversized_estimate"] })]).ok, false);
  assert.equal(checkSegments([seg({ legible: false })]).ok, false);
  assert.equal(checkSegments([seg({ confidence: 0.3 })]).ok, false);
  assert.equal(checkSegments([seg({ targetLang: "en" })]).ok, false);
  const mixed = checkSegments([seg(), seg({ sourceLang: "pt" })]);
  assert.equal(mixed.ok, false);
  assert.match(!mixed.ok ? mixed.reason : "", /mezclados/);
});

test("precio FR: Bulletin n°3 de 1 página = 30 € (caso 2026-00347)", () => {
  const r = priceFrSegments([seg()]);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.netEur, 30);
  assert.equal(r.lines[0].pages, 1);
  assert.match(r.lines[0].description, /^Certificado de antecedentes penales \(francés→español, 1 pág\.\)$/);
});

test("precio FR: 2 páginas 35 €, apostilla +5 €, varios documentos suman", () => {
  const r = priceFrSegments([seg({ pages: 2 }), seg({ specificType: "birth_certificate", hasApostille: true })]);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.netEur, 70);
});

test("precio FR: a mano desde 3 páginas, ES→FR, contratos y apostilla suelta", () => {
  assert.equal(priceFrSegments([seg({ pages: 3 })]).ok, false);
  assert.equal(priceFrSegments([seg({ sourceLang: "es", targetLang: "fr" })]).ok, false);
  assert.equal(priceFrSegments([seg({ specificType: "contract" })]).ok, false);
  assert.equal(priceFrSegments([seg({ specificType: "apostille" })]).ok, false);
});

test("decideAutoSend: frAllowed solo salta FR y sin coste; el resto de guardas sigue", () => {
  const base: AutoSendInput = {
    sourceLang: "fr",
    targetLang: "es",
    quoteStatus: "DRAFT",
    sentAt: null,
    sendingAt: null,
    netCents: 3000,
    customerEmail: "marie@example.fr",
    customerPhone: null,
    marginDetail: null,
    costMissing: true,
    heldByJuan: false,
    duplicate: null,
    alreadyCustomer: null,
  };
  const sin = decideAutoSend(base);
  assert.equal(sin.action, "alert");
  assert.equal(sin.action === "alert" && sin.reasons.length, 2);
  assert.deepEqual(decideAutoSend({ ...base, frAllowed: true }), { action: "send" });
  assert.equal(decideAutoSend({ ...base, frAllowed: true, netCents: 40000 }).action, "alert");
  assert.equal(decideAutoSend({ ...base, frAllowed: true, duplicate: "dup" }).action, "alert");
  assert.equal(decideAutoSend({ ...base, frAllowed: true, alreadyCustomer: "ya" }).action, "alert");
  assert.equal(decideAutoSend({ ...base, frAllowed: true, clientSaidNo: "no" }).action, "alert");
  assert.equal(decideAutoSend({ ...base, frAllowed: true, customerEmail: "1@whatsapp.local", customerPhone: "600111222" }).action, "alert");
  // fuera de FR no cambia nada: sin coste sigue frenando
  const de = decideAutoSend({ ...base, sourceLang: "de", frAllowed: true });
  assert.equal(de.action === "alert" && de.reasons.some((r) => /sin coste/.test(r)), true);
  assert.equal(decideAutoSend({ ...base, frAllowed: true, quoteStatus: "SENT" }).action, "skip");
});

test("bandejaAction: solo on + send envía; draft nunca", () => {
  assert.deepEqual(bandejaAction("on", { action: "send" }), { action: "send" });
  assert.equal(bandejaAction("draft", { action: "send" }).action, "draft");
  assert.deepEqual(bandejaAction("on", { action: "alert", reasons: ["margen"] }), { action: "draft", reasons: ["margen"] });
  assert.deepEqual(bandejaAction("on", { action: "skip", reason: "ya enviado" }), { action: "draft", reasons: ["ya enviado"] });
});

test("respuesta FR en español: precio, plazo, firma, traductor, enlace y pregunta de fecha", () => {
  const body = buildQuoteReply({
    lang: "es",
    name: "Marie",
    items: [{ label: "Certificado de antecedentes penales", pages: 1 }],
    netEur: 30,
    totalEur: 36.3,
    deliveryTerm: FR_DELIVERY_TERM,
    isFr: true,
    payUrl: "https://www.traduccionesjuradas.net/q/abc",
    askDeadline: true,
  });
  assert.match(body, /^Hola Marie:/);
  assert.match(body, /30 € \+ IVA = 36,30 €/);
  assert.match(body, /1 día hábil desde el pago/);
  assert.match(body, /firma electrónica cualificada/);
  assert.match(body, /Juan Silva Moreno, traductor-intérprete jurado .*3850/);
  assert.match(body, /https:\/\/www\.traduccionesjuradas\.net\/q\/abc/);
  assert.match(body, /Le adjunto el presupuesto en PDF/);
  assert.match(body, /¿Para qué fecha lo necesita\?/);
  assert.match(body, /Juan Silva Moreno · traductor jurado n\.º 3850 · traduccionesjuradas\.net$/);
});

test("respuesta no-FR: sin nombre de traductor; en francés y sin pregunta de fecha si ya la dio", () => {
  const body = buildQuoteReply({
    lang: "fr",
    name: null,
    items: [{ label: "Acta de nacimiento", labelFr: "acte de naissance", pages: 2 }],
    netEur: 45.5,
    totalEur: 55.06,
    deliveryTerm: "3-4 días hábiles",
    isFr: false,
    payUrl: "https://x/q/t",
    askDeadline: false,
    pdfLink: "https://blob/p.pdf",
  });
  assert.match(body, /^Bonjour,/);
  assert.match(body, /acte de naissance \(2 pages\)/);
  assert.match(body, /45,50 € HT \+ TVA = 55,06 €/);
  assert.match(body, /3-4 jours ouvrables/);
  assert.doesNotMatch(body, /Juan Silva/);
  assert.doesNotMatch(body, /Pour quelle date/);
  assert.match(body, /Le devis en PDF : https:\/\/blob\/p\.pdf/);
  assert.match(body, /TraduccionesJuradas\.net$/);
});

test("sin documento: pide el PDF y la fecha", () => {
  const es = buildNoDocDraft({ lang: "es", name: "Ana" });
  assert.match(es, /PDF/);
  assert.match(es, /fecha/);
  assert.match(buildNoDocDraft({ lang: "en", name: null }), /^Hello,/);
});

test("justificantes y facturas de proveedor no se leen", () => {
  assert.equal(looksLikePaymentOrInvoice({ subject: "Justificante de pago presupuesto 2026-00347" }), true);
  assert.equal(looksLikePaymentOrInvoice({ subject: "RE: devis", body: "Bonjour, voici la preuve de paiement" }), true);
  assert.equal(looksLikePaymentOrInvoice({ subject: "Factura 2026-118 octubre" }), true);
  assert.equal(looksLikePaymentOrInvoice({ subject: "Traducción", proofJson: { read: { esJustificante: true } } }), true);
  assert.equal(looksLikePaymentOrInvoice({ subject: "Traducir una factura", body: "Necesito traducir una factura de mi empresa" }), false);
  assert.equal(looksLikePaymentOrInvoice({ subject: "Traducción acta", body: "Adjunto el acta de nacimiento" }), false);
});

test("mismo documento repartido o repetido → a mano", () => {
  const pdf = { fileName: "a.pdf", mimeType: "application/pdf" };
  assert.match(String(splitOrRepeatedReason([{ fileName: "p1.jpg", mimeType: "image/jpeg" }, { fileName: "p2.jpg", mimeType: "image/jpeg" }], [seg(), seg()])), /imagen/);
  assert.equal(splitOrRepeatedReason([{ fileName: "p1.jpg", mimeType: "image/jpeg" }], [seg()]), null);
  assert.match(String(splitOrRepeatedReason([pdf], [seg({ fileName: "a.pdf" }), seg({ fileName: "a.pdf" })])), /mismo archivo/);
  assert.match(String(splitOrRepeatedReason([pdf, { fileName: "b.pdf", mimeType: "application/pdf" }], [seg({ fileName: "a.pdf", names: ["marie dupont"] }), seg({ fileName: "b.pdf", names: ["marie dupont"] })])), /titular/);
  assert.equal(splitOrRepeatedReason([pdf, { fileName: "b.pdf", mimeType: "application/pdf" }], [seg({ fileName: "a.pdf", names: ["marie"] }), seg({ fileName: "b.pdf", specificType: "birth_certificate", names: ["marie"] })]), null);
});

test("doble llave fuera de FR: sin LEARNED_RATES_AUTOSEND va a borrador", () => {
  assert.deepEqual(bandejaAction("on", { action: "send" }, { fr: false, learnedAutosend: false }), { action: "draft", reasons: [TARIFARIO_AUTOSEND_OFF] });
  assert.deepEqual(bandejaAction("on", { action: "send" }, { fr: false, learnedAutosend: true }), { action: "send" });
  assert.deepEqual(bandejaAction("on", { action: "send" }, { fr: true, learnedAutosend: false }), { action: "send" });
});

test("borrador de un presupuesto en DRAFT: nota interna, sin /q ni «le adjunto»", () => {
  const body = buildQuoteReply({
    lang: "es",
    name: "Ana",
    items: [{ label: "Acta (portugués→español, 1 pág)", pages: null }],
    netEur: 40,
    totalEur: 48.4,
    deliveryTerm: "3-4 días hábiles",
    isFr: false,
    payUrl: "https://www.traduccionesjuradas.net/q/tok",
    askDeadline: false,
    draftOf: { quoteNumber: "2026-00400" },
  });
  assert.match(body, /^\[NOTA INTERNA.*Antes de enviar: pulsa Enviar en el presupuesto 2026-00400 \(con email desactivado\) o pídeme que lo selle/);
  assert.doesNotMatch(body, /\/q\/tok/);
  assert.doesNotMatch(body, /adjunto/i);
  assert.match(body, /- Acta \(portugués→español, 1 pág\)\n/);
});

test("noreply en mitad de la dirección es automático", () => {
  assert.equal(looksAutomated({ fromEmail: "googledevelopers-noreply@google.com", subject: "[Action Advised] Manage your unused OAuth clients" }), true);
  assert.equal(looksAutomated({ fromEmail: "do-not-reply@banco.es" }), true);
  assert.equal(looksAutomated({ fromEmail: "noelia.reyes@gmail.com" }), false);
});

test("oferta de proveedor no es un cliente", () => {
  assert.equal(looksLikeVendorPitch({ subject: "Presentación profesional – Especialista en DTP y Maquetación Freelance", body: "Me pongo en contacto con ustedes para presentar mi trabajo" }), true);
  assert.equal(looksLikeVendorPitch({ subject: "Collaboration", body: "I am a freelance translator and would like to offer my services" }), true);
  assert.equal(looksLikeVendorPitch({ subject: "Traducción jurada", body: "Hola, necesito traducir mi acta de nacimiento y mi curriculum vitae para una oferta de trabajo" }), false);
  assert.equal(looksLikeVendorPitch({ subject: "Presupuesto traducción", body: "Necesito traducir mi título del francés al español" }), false);
});
