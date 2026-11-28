import { formatDateEs } from "./quotes.ts";
import { PAYMENT_LABELS } from "./payment-labels.ts";
import { localeFor, pickPublicLang, type PublicLang } from "./quote-public-i18n.ts";
import { includesFrench } from "./price-request-ack.ts";
import { C, SANS, SERIF, emailLayout, emailQuestionsBox, escapeHtml, stripTextSignature, textLinesToHtml, type SignatureKind } from "./email-layout.ts";
import { PAY_COPY } from "./email-copy.ts";

export { PAYMENT_LABELS };

// Sin nombre real (vacío, email, o la parte del email que pone el carril automático
// como «celinasu»): saludo genérico «Estimado/a cliente». Orden de Juan 29-oct-2026.
export function knownName(name: string | null | undefined) {
  const n = String(name || "").trim();
  if (!n || n.includes("@") || /\d/.test(n) || /^cliente?$/i.test(n)) return "";
  if (!/\s/.test(n) && n === n.toLowerCase()) return "";
  return n;
}

type CommonData = {
  name: string;
  payUrl: string;
  // Idioma del cliente (Quote.pdfLang); español por defecto.
  lang?: string | null;
  totalEur?: number | null;
  // Dos plazos: totalEur es el primer pago y balanceEur el segundo.
  balanceEur?: number | null;
  sourceLang?: string | null;
  targetLang?: string | null;
  // Plazo escrito del presupuesto ("2-3 días hábiles"); si falta, el estándar según el tipo de entrega.
  deliveryTerm?: string | null;
  deliveryType?: "DIGITAL_PDF" | "PAPER_SHIP" | null;
  // No residentes UE (vatRate 0): mentir "IVA incluido" no vale.
  vatExempt?: boolean;
  // Identidad del jurado que hará la traducción (directriz 12-ago: "da
  // seriedad") — la línea solo sale si hay nombre; el nº MAEC si se conoce.
  translatorName?: string | null;
  translatorMaec?: string | null;
};

type MsgDict = {
  hello: (name: string) => string;
  hi: string;
  subject: string;
  vat: string;
  noVat: string;
  total: string;
  firstPayment: string;
  secondPayment: string;
  delivery: string;
  cta: string;
  translator: (name: string, maec?: string | null) => string;
  paper: string;
  verify: string;
  start: string;
  sign: string;
  wa: { digital: string; paper: string; anyLang: string };
  paid: {
    subjectDigital: string;
    subjectPaper: string;
    confirmed: string;
    ref: string;
    eta: string;
    digital: string;
    paper: string;
    track: string;
    contact: string;
    sign: string;
  };
};

const MSG: Record<PublicLang, MsgDict> = {
  es: {
    hello: (n) => (n ? `Estimado/a ${n}:` : "Estimado/a cliente:"),
    hi: "Hola",
    subject: "Su presupuesto de traducción jurada",
    vat: "IVA incl.",
    noVat: "operación no sujeta a IVA — residente fuera de la UE",
    total: "Total",
    firstPayment: "Primer pago",
    secondPayment: "Segundo pago",
    delivery: "Entrega",
    cta: "Ver y pagar mi presupuesto",
    translator: (n, m) => `La traducción la realiza ${n}, traductor/a-intérprete jurado/a${m ? ` nº ${m} del MAEC` : ""}.`,
    paper: "El envío en papel (12 € + IVA) está incluido en el total.",
    verify: "Seguridad: la traducción en PDF lleva firma electrónica cualificada. Puede comprobar su validez en el servicio del Gobierno de España: valide.redsara.es",
    start: "En cuanto recibamos el pago empezamos la traducción.",
    sign: "Un saludo,\nJuan Silva — TraduccionesJuradas.net",
    wa: { digital: "Traducción jurada oficial en PDF con firma digital.", paper: "Traducción jurada oficial en papel, por mensajería.", anyLang: "Puede escribirnos en su idioma: le respondemos en él." },
    paid: {
      subjectDigital: "Pago recibido – Traducción jurada en formato digital",
      subjectPaper: "Pago recibido – Envío de traducción jurada en papel",
      confirmed: "Confirmamos la recepción del pago.",
      ref: "Referencia",
      eta: "Fecha estimada de entrega",
      digital: "Le enviaremos la traducción jurada en PDF firmado digitalmente a este mismo email.",
      paper: "Envío por mensajería 24/48 h una vez terminada la traducción (12 € + IVA incluidos en el importe abonado).",
      track: "Siga su pedido aquí",
      contact: "¿Dudas? Escriba a hola@traduccionesjuradas.net o por WhatsApp al +34 951 333 614 indicando la referencia.",
      sign: "Atentamente, Juan Silva – Traductor Jurado (MAEC).",
    },
  },
  en: {
    hello: (n) => (n ? `Dear ${n},` : "Dear customer,"),
    hi: "Hello",
    subject: "Your sworn translation quote",
    vat: "VAT incl.",
    noVat: "not subject to VAT — non-EU resident",
    total: "Total",
    firstPayment: "First payment",
    secondPayment: "Second payment",
    delivery: "Delivery",
    cta: "View the quote and pay",
    translator: (n, m) => `Your translation is done by ${n}, sworn translator${m ? ` MAEC no. ${m}` : ""}.`,
    paper: "Paper shipping (EUR 12 + VAT) is included in the total.",
    verify: "Security: the PDF translation carries a qualified electronic signature. You can check its validity with the Spanish Government service: valide.redsara.es",
    start: "We start the translation as soon as we receive your payment.",
    sign: "Best regards,\nJuan Silva — TraduccionesJuradas.net",
    wa: { digital: "Official sworn translation as a digitally signed PDF.", paper: "Official sworn translation on paper, by courier.", anyLang: "You can write to us in your language: we reply in it." },
    paid: {
      subjectDigital: "Payment received – Sworn translation (digital)",
      subjectPaper: "Payment received – Sworn translation (paper)",
      confirmed: "We confirm we have received your payment.",
      ref: "Reference",
      eta: "Estimated delivery date",
      digital: "We will send the sworn translation as a digitally signed PDF to this same email.",
      paper: "Courier shipping 24/48 h once the translation is finished (EUR 12 + VAT included in the amount paid).",
      track: "Track your order here",
      contact: "Questions? Write to hola@traduccionesjuradas.net or on WhatsApp at +34 951 333 614 quoting the reference.",
      sign: "Kind regards, Juan Silva – Sworn Translator (MAEC).",
    },
  },
  fr: {
    hello: (n) => (n ? `Bonjour ${n},` : "Bonjour,"),
    hi: "Bonjour",
    subject: "Votre devis de traduction assermentée",
    vat: "TVA incl.",
    noVat: "opération non soumise à la TVA — résident hors UE",
    total: "Total",
    firstPayment: "Premier paiement",
    secondPayment: "Second paiement",
    delivery: "Livraison",
    cta: "Voir le devis et payer",
    translator: (n, m) => `Votre traduction est réalisée par ${n}, traducteur/trice assermenté(e)${m ? ` n° ${m} du MAEC` : ""}.`,
    paper: "L'envoi papier (12 € + TVA) est inclus dans le total.",
    verify: "Sécurité : la traduction en PDF porte une signature électronique qualifiée. Vous pouvez vérifier sa validité sur le service du gouvernement espagnol : valide.redsara.es",
    start: "Nous commençons la traduction dès réception du paiement.",
    sign: "Cordialement,\nJuan Silva — TraduccionesJuradas.net",
    wa: { digital: "Traduction assermentée officielle en PDF signé numériquement.", paper: "Traduction assermentée officielle sur papier, par transporteur.", anyLang: "Vous pouvez nous écrire dans votre langue : nous répondons dans la même." },
    paid: {
      subjectDigital: "Paiement reçu – Traduction assermentée (numérique)",
      subjectPaper: "Paiement reçu – Traduction assermentée (papier)",
      confirmed: "Nous confirmons la réception de votre paiement.",
      ref: "Référence",
      eta: "Date de livraison estimée",
      digital: "Nous vous enverrons la traduction assermentée en PDF signé numériquement à cette même adresse.",
      paper: "Envoi par transporteur 24/48 h une fois la traduction terminée (12 € + TVA inclus dans le montant payé).",
      track: "Suivez votre commande ici",
      contact: "Une question ? Écrivez à hola@traduccionesjuradas.net ou sur WhatsApp au +34 951 333 614 en indiquant la référence.",
      sign: "Cordialement, Juan Silva – Traducteur assermenté (MAEC).",
    },
  },
  pt: {
    hello: (n) => (n ? `Caro/a ${n},` : "Caro/a cliente,"),
    hi: "Olá",
    subject: "O seu orçamento de tradução juramentada",
    vat: "IVA incl.",
    noVat: "operação não sujeita a IVA — residente fora da UE",
    total: "Total",
    firstPayment: "Primeiro pagamento",
    secondPayment: "Segundo pagamento",
    delivery: "Entrega",
    cta: "Ver o orçamento e pagar",
    translator: (n, m) => `A tradução é feita por ${n}, tradutor/a juramentado/a${m ? ` n.º ${m} do MAEC` : ""}.`,
    paper: "O envio em papel (12 € + IVA) está incluído no total.",
    verify: "Segurança: a tradução em PDF tem assinatura eletrónica qualificada. Pode verificar a sua validade no serviço do Governo de Espanha: valide.redsara.es",
    start: "Começamos a tradução assim que recebermos o pagamento.",
    sign: "Com os melhores cumprimentos,\nJuan Silva — TraduccionesJuradas.net",
    wa: { digital: "Tradução juramentada oficial em PDF com assinatura digital.", paper: "Tradução juramentada oficial em papel, por correio expresso.", anyLang: "Pode escrever-nos no seu idioma: respondemos nele." },
    paid: {
      subjectDigital: "Pagamento recebido – Tradução juramentada (digital)",
      subjectPaper: "Pagamento recebido – Tradução juramentada (papel)",
      confirmed: "Confirmamos a receção do seu pagamento.",
      ref: "Referência",
      eta: "Data estimada de entrega",
      digital: "Enviaremos a tradução juramentada em PDF com assinatura digital para este mesmo email.",
      paper: "Envio por correio expresso 24/48 h após terminar a tradução (12 € + IVA incluídos no valor pago).",
      track: "Acompanhe o seu pedido aqui",
      contact: "Dúvidas? Escreva para hola@traduccionesjuradas.net ou por WhatsApp para +34 951 333 614 indicando a referência.",
      sign: "Com os melhores cumprimentos, Juan Silva – Tradutor Juramentado (MAEC).",
    },
  },
  it: {
    hello: (n) => (n ? `Gentile ${n},` : "Gentile cliente,"),
    hi: "Ciao",
    subject: "Il suo preventivo di traduzione giurata",
    vat: "IVA incl.",
    noVat: "operazione non soggetta a IVA — residente fuori dalla UE",
    total: "Totale",
    firstPayment: "Primo pagamento",
    secondPayment: "Secondo pagamento",
    delivery: "Consegna",
    cta: "Vedere il preventivo e pagare",
    translator: (n, m) => `La traduzione è eseguita da ${n}, traduttore/trice giurato/a${m ? ` n. ${m} del MAEC` : ""}.`,
    paper: "La spedizione cartacea (12 € + IVA) è inclusa nel totale.",
    verify: "Sicurezza: la traduzione in PDF ha una firma elettronica qualificata. Può verificarne la validità sul servizio del Governo spagnolo: valide.redsara.es",
    start: "Iniziamo la traduzione appena riceviamo il pagamento.",
    sign: "Cordiali saluti,\nJuan Silva — TraduccionesJuradas.net",
    wa: { digital: "Traduzione giurata ufficiale in PDF con firma digitale.", paper: "Traduzione giurata ufficiale su carta, con corriere.", anyLang: "Può scriverci nella sua lingua: rispondiamo nella stessa." },
    paid: {
      subjectDigital: "Pagamento ricevuto – Traduzione giurata (digitale)",
      subjectPaper: "Pagamento ricevuto – Traduzione giurata (cartacea)",
      confirmed: "Confermiamo la ricezione del pagamento.",
      ref: "Riferimento",
      eta: "Data di consegna stimata",
      digital: "Le invieremo la traduzione giurata in PDF con firma digitale a questo stesso indirizzo.",
      paper: "Spedizione con corriere 24/48 h a traduzione terminata (12 € + IVA inclusi nell'importo pagato).",
      track: "Segua il suo ordine qui",
      contact: "Domande? Scriva a hola@traduccionesjuradas.net o su WhatsApp al +34 951 333 614 indicando il riferimento.",
      sign: "Cordiali saluti, Juan Silva – Traduttore Giurato (MAEC).",
    },
  },
  de: {
    hello: (n) => (n ? `Guten Tag ${n},` : "Guten Tag,"),
    hi: "Hallo",
    subject: "Ihr Angebot für die beeidigte Übersetzung",
    vat: "inkl. MwSt.",
    noVat: "nicht mehrwertsteuerpflichtig — Wohnsitz außerhalb der EU",
    total: "Gesamt",
    firstPayment: "Erste Zahlung",
    secondPayment: "Zweite Zahlung",
    delivery: "Lieferung",
    cta: "Angebot ansehen und bezahlen",
    translator: (n, m) => `Die Übersetzung erstellt ${n}, beeidigte/r Übersetzer/in${m ? ` Nr. ${m} (MAEC)` : ""}.`,
    paper: "Der Papierversand (12 € + MwSt.) ist im Gesamtpreis enthalten.",
    verify: "Sicherheit: Die PDF-Übersetzung trägt eine qualifizierte elektronische Signatur. Die Gültigkeit können Sie beim Dienst der spanischen Regierung prüfen: valide.redsara.es",
    start: "Wir beginnen mit der Übersetzung, sobald die Zahlung eingegangen ist.",
    sign: "Mit freundlichen Grüßen\nJuan Silva — TraduccionesJuradas.net",
    wa: { digital: "Offizielle beeidigte Übersetzung als digital signiertes PDF.", paper: "Offizielle beeidigte Übersetzung auf Papier, per Kurier.", anyLang: "Sie können uns in Ihrer Sprache schreiben: Wir antworten in ihr." },
    paid: {
      subjectDigital: "Zahlung eingegangen – Beeidigte Übersetzung (digital)",
      subjectPaper: "Zahlung eingegangen – Beeidigte Übersetzung (Papier)",
      confirmed: "Wir bestätigen den Eingang Ihrer Zahlung.",
      ref: "Referenz",
      eta: "Voraussichtliches Lieferdatum",
      digital: "Wir senden Ihnen die beeidigte Übersetzung als digital signiertes PDF an diese E-Mail-Adresse.",
      paper: "Kurierversand 24/48 h nach Fertigstellung (12 € + MwSt. im bezahlten Betrag enthalten).",
      track: "Bestellung hier verfolgen",
      contact: "Fragen? Schreiben Sie an hola@traduccionesjuradas.net oder per WhatsApp an +34 951 333 614 mit der Referenz.",
      sign: "Mit freundlichen Grüßen, Juan Silva – Beeidigter Übersetzer (MAEC).",
    },
  },
};

function moneyIn(eur: number, lang: PublicLang) {
  return new Intl.NumberFormat(localeFor(lang), { style: "currency", currency: "EUR" }).format(eur);
}

// «Total X (IVA incl.) · Entrega …»: la línea que decide el pago. La entrega solo
// sale si el presupuesto trae plazo: no se inventa uno.
function summaryLine(d: CommonData, m: MsgDict, lang: PublicLang) {
  const split = d.balanceEur != null && d.balanceEur > 0;
  const parts: string[] = [];
  if (d.totalEur != null) {
    parts.push(`${split ? m.firstPayment : m.total} ${moneyIn(d.totalEur, lang)} (${d.vatExempt ? m.noVat : m.vat})`);
  }
  if (split) parts.push(`${m.secondPayment} ${moneyIn(d.balanceEur as number, lang)}`);
  const term = d.deliveryTerm?.trim();
  if (term) parts.push(`${m.delivery}: ${term}`);
  return parts.join(" · ");
}

function langPair(d: CommonData, lang: PublicLang) {
  if (!d.sourceLang || !d.targetLang) return "";
  try {
    const dn = new Intl.DisplayNames([localeFor(lang)], { type: "language" });
    return `${dn.of(d.sourceLang) || d.sourceLang} → ${dn.of(d.targetLang) || d.targetLang}`;
  } catch {
    return `${d.sourceLang} → ${d.targetLang}`;
  }
}

// Enlace directo al pago con tarjeta: solo para /q/<token> (la página que lo
// entiende con ?pago=tarjeta). Un enlace firmado de pedido no lo lleva.
export function cardPayUrl(payUrl: string): string | null {
  try {
    const u = new URL(payUrl);
    if (!u.pathname.startsWith("/q/")) return null;
    u.searchParams.set("pago", "tarjeta");
    return u.toString();
  } catch {
    return null;
  }
}

export function renderSimpleEmailHtml(body: string, opts: { label?: string | null; title?: string | null; signature?: SignatureKind | null } = {}) {
  return emailLayout({ content: textLinesToHtml(body), ...opts });
}

export type PayLinkDecor = {
  lang?: string | null;
  quoteNumber?: string | null;
  lines?: { description: string; amountEur: number }[];
  discountEur?: number | null;
  shippingEur?: number | null;
  vatRate?: number | null;
  vatEur?: number | null;
  // Lo que se cobra ahora (Quote.total); con plazos, el primero.
  totalEur?: number | null;
  // Segundo plazo (Quote.balanceAmount, IVA incluido).
  balanceEur?: number | null;
  houseSignature?: boolean;
};

export type BreakdownRow = { kind: "line" | "discount" | "shipping" | "vat" | "balance"; label: string; amountEur: number };

const r2 = (n: number) => Math.round(n * 100) / 100;

// Filas del desglose con su signo (el descuento resta) y el total del presupuesto: lo mismo que
// cobra /q (líneas − descuento + envío + IVA = primer pago; + segundo plazo = total).
export function payLinkBreakdown(d: PayLinkDecor, lang: PublicLang = pickPublicLang(d.lang)): { rows: BreakdownRow[]; quoteTotalEur: number; payNowEur: number | null } | null {
  const lines = d.lines || [];
  if (!lines.length || d.totalEur == null) return null;
  const c = PAY_COPY[lang];
  const rows: BreakdownRow[] = lines.map((l) => ({ kind: "line", label: l.description, amountEur: l.amountEur }));
  if (d.discountEur && d.discountEur > 0) rows.push({ kind: "discount", label: c.discount, amountEur: -d.discountEur });
  if (d.shippingEur && d.shippingEur > 0) rows.push({ kind: "shipping", label: c.shipping, amountEur: d.shippingEur });
  if (d.vatEur && d.vatEur > 0) {
    const pct = d.vatRate ? ` ${Math.round(d.vatRate <= 1 ? d.vatRate * 100 : d.vatRate)} %` : "";
    rows.push({ kind: "vat", label: `${c.vat}${pct}`, amountEur: d.vatEur });
  }
  const split = d.balanceEur != null && d.balanceEur > 0;
  if (split) rows.push({ kind: "balance", label: c.secondInstalment, amountEur: d.balanceEur as number });
  return { rows, quoteTotalEur: r2(d.totalEur + (split ? (d.balanceEur as number) : 0)), payNowEur: split ? d.totalEur : null };
}

function breakdownTable(d: PayLinkDecor, lang: PublicLang) {
  const b = payLinkBreakdown(d, lang);
  if (!b) return "";
  const c = PAY_COPY[lang];
  const cell = (strong: boolean) =>
    strong
      ? `font-family:${SANS};font-size:15px;color:${C.navy};padding:14px 20px;border-bottom:1px solid ${C.rule};`
      : `font-family:${SANS};font-size:14px;color:${C.muted};padding:10px 20px;border-bottom:1px solid ${C.rule};`;
  const rows = b.rows
    .map((r) => {
      const st = cell(r.kind === "line");
      const amount = r.amountEur < 0 ? `− ${moneyIn(-r.amountEur, lang)}` : moneyIn(r.amountEur, lang);
      return `<tr><td style="${st}${r.kind === "line" ? "font-weight:bold;" : ""}">${escapeHtml(r.label)}</td><td align="right" style="${st}white-space:nowrap;">${amount}</td></tr>`;
    })
    .join("");
  const totalLabel = b.payNowEur != null ? c.quoteTotal : MSG[lang].total;
  const total = `<tr><td style="font-family:${SANS};font-size:16px;font-weight:bold;color:${C.navy};padding:14px 20px 18px 20px;">${totalLabel}</td><td align="right" style="font-family:${SERIF};font-size:26px;color:${C.navy};padding:14px 20px 18px 20px;white-space:nowrap;">${moneyIn(b.quoteTotalEur, lang)}</td></tr>`;
  const payNow =
    b.payNowEur != null
      ? `<tr><td colspan="2" bgcolor="${C.soft}" style="background:${C.soft};font-family:${SANS};font-size:15px;font-weight:bold;color:${C.navy};padding:12px 20px;border-radius:0 0 10px 10px;">${escapeHtml(c.payNow(moneyIn(b.payNowEur, lang)))}</td></tr>`
      : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.white}" style="background:${C.white};border:1px solid ${C.border};border-radius:10px;border-collapse:separate;margin:8px 0 20px 0;">${rows}${total}${payNow}</table>`;
}

type Num = number | string | { toString(): string } | null | undefined;
const num = (v: Num) => (v == null ? null : Number(v.toString()));

// Decorado del email a partir del presupuesto: desglose como en /q, IVA, plazos y total.
export function payLinkDecorFromQuote(q: {
  pdfLang?: string | null;
  quoteNumber: string;
  sourceLang?: string | null;
  targetLang?: string | null;
  vatRate?: Num;
  vatAmount?: Num;
  discountAmount?: Num;
  shippingAmount?: Num;
  total?: Num;
  balanceAmount?: Num;
  lines?: { description: string; lineTotal: Num }[];
}): PayLinkDecor {
  return {
    lang: q.pdfLang,
    quoteNumber: q.quoteNumber,
    lines: (q.lines || []).map((l) => ({ description: l.description, amountEur: num(l.lineTotal) ?? 0 })),
    discountEur: num(q.discountAmount),
    shippingEur: num(q.shippingAmount),
    vatRate: num(q.vatRate),
    vatEur: num(q.vatAmount),
    totalEur: num(q.total),
    balanceEur: num(q.balanceAmount),
    houseSignature: !includesFrench(q.sourceLang, q.targetLang),
  };
}

// Email del presupuesto (/q) con la imagen de la casa: el cuerpo (el estándar o el que edita
// el staff) manda; el desglose va antes del botón y la caja de las dos preguntas al final.
// Sin par FR explícito, firma de la casa.
export function renderPayLinkEmailHtml(body: string, d: PayLinkDecor = {}) {
  const lang = pickPublicLang(d.lang);
  const content = textLinesToHtml(stripTextSignature(body), { onFirstButton: breakdownTable(d, lang) }) + emailQuestionsBox(lang);
  return emailLayout({
    content,
    label: d.quoteNumber ? `${PAY_COPY[lang].quote} ${d.quoteNumber}` : null,
    title: PAY_COPY[lang].title,
    signature: d.houseSignature === false ? "juan" : "house",
  });
}

export function buildPayLinkEmail(data: CommonData) {
  const lang = pickPublicLang(data.lang);
  const m = MSG[lang];
  // Una sola llamada a la acción: el enlace al presupuesto. Los métodos de pago
  // (Bizum, transferencia, tarjeta, justificante) viven solo en /q.
  const top = [m.hello(knownName(data.name)), summaryLine(data, m, lang), `${m.cta}: ${data.payUrl}`].join("\n");
  const body = [
    top,
    data.translatorName ? m.translator(data.translatorName, data.translatorMaec) : "",
    data.deliveryType === "PAPER_SHIP" ? m.paper : m.verify,
    m.start,
    m.sign,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject: m.subject, body };
}

export function buildWhatsAppPayText(data: CommonData) {
  const lang = pickPublicLang(data.lang);
  const m = MSG[lang];
  return [
    `${m.hi}${knownName(data.name) ? ` ${knownName(data.name)}` : ""} 👋`,
    summaryLine(data, m, lang),
    `${m.cta}: ${data.payUrl}`,
    langPair(data, lang),
    data.translatorName ? m.translator(data.translatorName, data.translatorMaec) : "",
    data.deliveryType === "PAPER_SHIP" ? m.wa.paper : `${m.wa.digital} ${m.verify}`,
    m.wa.anyLang,
  ]
    .filter(Boolean)
    .join("\n");
}

type PaidData = { name: string; etaDate: Date; quoteNumber?: string | null; trackUrl?: string | null; lang?: string | null };

function buildPaidEmail(data: PaidData, paper: boolean) {
  const lang = pickPublicLang(data.lang);
  const m = MSG[lang].paid;
  const eta = data.etaDate.toLocaleDateString(localeFor(lang), { day: "numeric", month: "long", year: "numeric" });
  const body = [
    `${MSG[lang].hello(knownName(data.name))}\n${m.confirmed} ✅`,
    [data.quoteNumber ? `${m.ref}: ${data.quoteNumber}` : "", `${m.eta}: ${eta}`].filter(Boolean).join("\n"),
    paper ? m.paper : m.digital,
    data.trackUrl ? `${m.track}: ${data.trackUrl}` : "",
    m.contact,
    m.sign,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject: paper ? m.subjectPaper : m.subjectDigital, body };
}

export function buildPaidDigitalEmail(data: PaidData) {
  return buildPaidEmail(data, false);
}

export function buildPaidPaperEmail(data: PaidData) {
  return buildPaidEmail(data, true);
}

export function buildReminderEmail(data: {
  name: string;
  quoteNumber: string;
  sentDate: Date;
  payUrl: string;
}) {
  const subject = "Recordatorio: presupuesto pendiente de confirmación";
  const body = `Estimado/a ${knownName(data.name) || "cliente"},
Le recordamos que el presupuesto ${data.quoteNumber} enviado el ${formatDateEs(data.sentDate)} sigue pendiente de confirmación.
Ver y pagar mi presupuesto: ${data.payUrl}
Quedo a su disposición. – Juan Silva`;
  return { subject, body };
}

export function buildExpiredEmail(data: { name: string; quoteNumber: string; payUrl: string }) {
  const subject = "Presupuesto expirado";
  // Los enlaces de motivo aterrizan en la página pública con el motivo preseleccionado;
  // el registro real exige confirmar con un botón (POST) — los escáneres de email
  // pre-abren enlaces y un GET que escribiera en BD llenaría esto de motivos falsos.
  const body = `Estimado/a ${knownName(data.name) || "cliente"},
El presupuesto ${data.quoteNumber} ha expirado.
Si desea retomarlo, responda a este correo o use este enlace para solicitar actualización: ${data.payUrl}
Si decidió no seguir adelante, nos ayudaría mucho conocer el motivo (solo un clic):
· El precio: ${data.payUrl}?fb=PRICE
· El plazo: ${data.payUrl}?fb=DEADLINE
· Ya no lo necesito: ${data.payUrl}?fb=NO_LONGER_NEEDED
· Lo resolví con otro traductor: ${data.payUrl}?fb=SOLVED_ELSEWHERE
· Otro motivo: ${data.payUrl}?fb=OTHER
Atentamente, Juan Silva – Traductor Jurado (MAEC).`;
  return { subject, body };
}

export function buildWhatsAppReminderText(data: { name: string; payUrl: string }) {
  return `Hola${knownName(data.name) ? ` ${knownName(data.name)}` : ""}, le escribo desde TraduccionesJuradas.net para recordarle que su presupuesto sigue pendiente de confirmación. Puede completarlo aquí: ${data.payUrl}. Quedo atento.`;
}

// ── Captación de leads con presupuesto que no llegó / no se revisó ────────────
// Mensaje humano (NO transaccional): ofrece que un traductor jurado revise el
// caso personalmente. Localizado es/fr/en según el idioma del cliente.

export type CaptureLang = "es" | "fr" | "en";

/** Resuelve el idioma del mensaje de captación: clientLocale del pedido, si no
 *  el idioma de origen del documento; fr→fr, es→es, cualquier otro→inglés. */
export function resolveCaptureLang(opts: {
  clientLocale?: string | null;
  sourceLang?: string | null;
}): CaptureLang {
  const v = opts.clientLocale || opts.sourceLang || "es";
  if (v === "fr") return "fr";
  if (v === "es") return "es";
  return "en";
}

/** Email de captación "un traductor analiza tu presupuesto". `payUrl` opcional:
 *  inclúyelo SOLO si el presupuesto se entregó de verdad (no enlaces un DRAFT
 *  con precios sin revisar). */
export function buildTranslatorReviewEmail(data: {
  name: string;
  lang?: CaptureLang;
  payUrl?: string | null;
}) {
  const lang = data.lang || "es";
  if (lang === "fr") {
    const link = data.payUrl ? ` ${data.payUrl}` : "";
    return {
      subject: "Votre devis de traduction assermentée — souhaitez-vous qu'on le revoie ensemble ?",
      body: `Bonjour${knownName(data.name) ? ` ${knownName(data.name)}` : ""},
Nous avons préparé le devis de votre traduction assermentée, mais il semble que vous n'ayez pas pu le consulter.
Pour lever tout doute, un traducteur assermenté peut étudier votre dossier personnellement — document, délai et validité officielle auprès de l'organisme destinataire — sans engagement.
Répondez à ce courriel ou écrivez-nous sur WhatsApp et nous le voyons aujourd'hui même.${link}
Cordialement, Juan Silva — Traducteur assermenté (MAEC).`,
    };
  }
  if (lang === "en") {
    const link = data.payUrl ? ` ${data.payUrl}` : "";
    return {
      subject: "Your sworn translation quote — shall we review it together?",
      body: `Dear ${knownName(data.name) || "customer"},
We've prepared the quote for your sworn translation, but it looks like you haven't had a chance to review it.
To clear up any doubts, a sworn translator can review your case personally — document, turnaround time and official validity before the receiving authority — at no obligation.
Reply to this email or message us on WhatsApp and we'll look at it today.${link}
Best regards, Juan Silva — Sworn Translator (MAEC).`,
    };
  }
  const link = data.payUrl ? ` ${data.payUrl}` : "";
  return {
    subject: "Su presupuesto de traducción jurada — ¿lo revisamos juntos?",
    body: `Estimado/a ${knownName(data.name) || "cliente"},
Hemos preparado el presupuesto de su traducción jurada, pero no nos consta que haya podido revisarlo.
Para que no se quede con dudas, un traductor jurado puede analizar su caso personalmente —documento, plazo y validez oficial ante el organismo de destino— sin compromiso.
Responda a este correo o escríbanos por WhatsApp y lo vemos hoy mismo.${link}
Atentamente, Juan Silva — Traductor Jurado (MAEC).`,
  };
}

/** Texto de WhatsApp equivalente (para leads sin email entregable). */
export function buildWhatsAppTranslatorReviewText(data: {
  name: string;
  lang?: CaptureLang;
  payUrl?: string | null;
}) {
  const lang = data.lang || "es";
  const link = data.payUrl ? ` ${data.payUrl}` : "";
  if (lang === "fr") {
    return `Bonjour${knownName(data.name) ? ` ${knownName(data.name)}` : ""}, équipe de TraduccionesJuradas.net. Nous avons préparé votre devis de traduction assermentée mais il n'a pas été consulté. Souhaitez-vous qu'un traducteur assermenté étudie votre dossier personnellement ? Nous répondons aujourd'hui.${link}`;
  }
  if (lang === "en") {
    return `Hi${knownName(data.name) ? ` ${knownName(data.name)}` : ""}, this is the TraduccionesJuradas.net team. We prepared your sworn translation quote but it looks like you haven't seen it. Would you like a sworn translator to review your case personally? We'll reply today.${link}`;
  }
  return `Hola${knownName(data.name) ? ` ${knownName(data.name)}` : ""}, soy del equipo de TraduccionesJuradas.net. Preparamos su presupuesto de traducción jurada pero no nos consta que lo viera. ¿Quiere que un traductor jurado revise su caso personalmente? Le respondemos hoy.${link}`;
}
