import { formatDateEs } from "./quotes.ts";
import { PAYMENT_LABELS } from "./payment-labels.ts";
import { localeFor, pickPublicLang, type PublicLang } from "./quote-public-i18n.ts";

export { PAYMENT_LABELS };

type CommonData = {
  name: string;
  payUrl: string;
  // Idioma del cliente (Quote.pdfLang); español por defecto.
  lang?: string | null;
  totalEur?: number | null;
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
  delivery: string;
  days: (n: number) => string;
  cta: string;
  translator: (name: string, maec?: string | null) => string;
  paper: string;
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
    hello: (n) => `Estimado/a ${n}:`,
    hi: "Hola",
    subject: "Su presupuesto de traducción jurada",
    vat: "IVA incl.",
    noVat: "operación no sujeta a IVA — residente fuera de la UE",
    total: "Total",
    delivery: "Entrega",
    days: (n) => `${n} días hábiles desde el pago`,
    cta: "Ver el presupuesto y pagar",
    translator: (n, m) => `La traducción la realiza ${n}, traductor/a-intérprete jurado/a${m ? ` nº ${m}` : ""}.`,
    paper: "El envío en papel (12 € + IVA) está incluido en el total.",
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
    hello: (n) => `Dear ${n},`,
    hi: "Hello",
    subject: "Your sworn translation quote",
    vat: "VAT incl.",
    noVat: "not subject to VAT — non-EU resident",
    total: "Total",
    delivery: "Delivery",
    days: (n) => `${n} business days from payment`,
    cta: "View the quote and pay",
    translator: (n, m) => `Your translation is done by ${n}, sworn translator${m ? ` no. ${m}` : ""}.`,
    paper: "Paper shipping (EUR 12 + VAT) is included in the total.",
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
    hello: (n) => `Bonjour ${n},`,
    hi: "Bonjour",
    subject: "Votre devis de traduction assermentée",
    vat: "TVA incl.",
    noVat: "opération non soumise à la TVA — résident hors UE",
    total: "Total",
    delivery: "Livraison",
    days: (n) => `${n} jours ouvrés après le paiement`,
    cta: "Voir le devis et payer",
    translator: (n, m) => `Votre traduction est réalisée par ${n}, traducteur/trice assermenté(e)${m ? ` n° ${m}` : ""}.`,
    paper: "L'envoi papier (12 € + TVA) est inclus dans le total.",
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
    hello: (n) => `Caro/a ${n},`,
    hi: "Olá",
    subject: "O seu orçamento de tradução juramentada",
    vat: "IVA incl.",
    noVat: "operação não sujeita a IVA — residente fora da UE",
    total: "Total",
    delivery: "Entrega",
    days: (n) => `${n} dias úteis após o pagamento`,
    cta: "Ver o orçamento e pagar",
    translator: (n, m) => `A tradução é feita por ${n}, tradutor/a juramentado/a${m ? ` n.º ${m}` : ""}.`,
    paper: "O envio em papel (12 € + IVA) está incluído no total.",
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
    hello: (n) => `Gentile ${n},`,
    hi: "Ciao",
    subject: "Il suo preventivo di traduzione giurata",
    vat: "IVA incl.",
    noVat: "operazione non soggetta a IVA — residente fuori dalla UE",
    total: "Totale",
    delivery: "Consegna",
    days: (n) => `${n} giorni lavorativi dal pagamento`,
    cta: "Vedere il preventivo e pagare",
    translator: (n, m) => `La traduzione è eseguita da ${n}, traduttore/trice giurato/a${m ? ` n. ${m}` : ""}.`,
    paper: "La spedizione cartacea (12 € + IVA) è inclusa nel totale.",
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
    hello: (n) => `Guten Tag ${n},`,
    hi: "Hallo",
    subject: "Ihr Angebot für die beeidigte Übersetzung",
    vat: "inkl. MwSt.",
    noVat: "nicht mehrwertsteuerpflichtig — Wohnsitz außerhalb der EU",
    total: "Gesamt",
    delivery: "Lieferung",
    days: (n) => `${n} Werktage ab Zahlungseingang`,
    cta: "Angebot ansehen und bezahlen",
    translator: (n, m) => `Die Übersetzung erstellt ${n}, beeidigte/r Übersetzer/in${m ? ` Nr. ${m}` : ""}.`,
    paper: "Der Papierversand (12 € + MwSt.) ist im Gesamtpreis enthalten.",
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

// «Total X (IVA incl.) · Entrega …»: la línea que decide el pago.
function summaryLine(d: CommonData, m: MsgDict, lang: PublicLang) {
  const days = d.deliveryType === "PAPER_SHIP" ? 3 : 2;
  const term = d.deliveryTerm?.trim() || m.days(days);
  const total = d.totalEur != null ? `${m.total} ${moneyIn(d.totalEur, lang)} (${d.vatExempt ? m.noVat : m.vat}) · ` : "";
  return `${total}${m.delivery}: ${term}`;
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

export function renderSimpleEmailHtml(body: string) {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const content = escaped
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 12px 0; font-family:Arial, sans-serif; font-size:15px; color:#0f172a;">${line}</p>`)
    .join("");
  return `
    <div style="background:#f8fafc; padding:24px 12px;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:22px;">
        <div style="margin-bottom:14px;">
          <a href="https://www.traduccionesjuradas.net" style="text-decoration:none;" target="_blank" rel="noopener noreferrer">
            <img src="https://www.traduccionesjuradas.net/brand/logo-horizontal.svg" alt="Traducciones Juradas" style="height:44px; width:auto; max-width:240px;" />
          </a>
        </div>
        ${content}
        <hr style="margin:18px 0 12px 0; border:0; border-top:1px solid #e2e8f0;" />
        <p style="margin:0; font-family:Arial, sans-serif; font-size:12px; color:#64748b;">
          TraduccionesJuradas.net · hola@traduccionesjuradas.net · 951 333 614
        </p>
      </div>
    </div>
  `;
}

export function buildPayLinkEmail(data: CommonData) {
  const lang = pickPublicLang(data.lang);
  const m = MSG[lang];
  // Una sola llamada a la acción: el enlace al presupuesto. Los métodos de pago
  // (Bizum, transferencia, tarjeta, justificante) viven solo en /q.
  const top = [m.hello(data.name), summaryLine(data, m, lang), `${m.cta}: ${data.payUrl}`].join("\n");
  const body = [
    top,
    data.translatorName ? m.translator(data.translatorName, data.translatorMaec) : "",
    data.deliveryType === "PAPER_SHIP" ? m.paper : "",
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
    `${m.hi} ${data.name} 👋`,
    summaryLine(data, m, lang),
    `${m.cta}: ${data.payUrl}`,
    data.translatorName ? m.translator(data.translatorName, data.translatorMaec) : "",
    data.deliveryType === "PAPER_SHIP" ? m.wa.paper : m.wa.digital,
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
    `${MSG[lang].hello(data.name)}\n${m.confirmed} ✅`,
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
  const body = `Estimado/a ${data.name},
Le recordamos que el presupuesto ${data.quoteNumber} enviado el ${formatDateEs(data.sentDate)} sigue pendiente de confirmación.
Puede revisarlo y realizar el pago aquí: ${data.payUrl}
Quedo a su disposición. – Juan Silva`;
  return { subject, body };
}

export function buildExpiredEmail(data: { name: string; quoteNumber: string; payUrl: string }) {
  const subject = "Presupuesto expirado";
  // Los enlaces de motivo aterrizan en la página pública con el motivo preseleccionado;
  // el registro real exige confirmar con un botón (POST) — los escáneres de email
  // pre-abren enlaces y un GET que escribiera en BD llenaría esto de motivos falsos.
  const body = `Estimado/a ${data.name},
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
  return `Hola ${data.name}, le escribo desde TraduccionesJuradas.net para recordarle que su presupuesto sigue pendiente de confirmación. Puede completarlo aquí: ${data.payUrl}. Quedo atento.`;
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
      body: `Bonjour ${data.name},
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
      body: `Dear ${data.name},
We've prepared the quote for your sworn translation, but it looks like you haven't had a chance to review it.
To clear up any doubts, a sworn translator can review your case personally — document, turnaround time and official validity before the receiving authority — at no obligation.
Reply to this email or message us on WhatsApp and we'll look at it today.${link}
Best regards, Juan Silva — Sworn Translator (MAEC).`,
    };
  }
  const link = data.payUrl ? ` ${data.payUrl}` : "";
  return {
    subject: "Su presupuesto de traducción jurada — ¿lo revisamos juntos?",
    body: `Estimado/a ${data.name},
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
    return `Bonjour ${data.name}, équipe de TraduccionesJuradas.net. Nous avons préparé votre devis de traduction assermentée mais il n'a pas été consulté. Souhaitez-vous qu'un traducteur assermenté étudie votre dossier personnellement ? Nous répondons aujourd'hui.${link}`;
  }
  if (lang === "en") {
    return `Hi ${data.name}, this is the TraduccionesJuradas.net team. We prepared your sworn translation quote but it looks like you haven't seen it. Would you like a sworn translator to review your case personally? We'll reply today.${link}`;
  }
  return `Hola ${data.name}, soy del equipo de TraduccionesJuradas.net. Preparamos su presupuesto de traducción jurada pero no nos consta que lo viera. ¿Quiere que un traductor jurado revise su caso personalmente? Le respondemos hoy.${link}`;
}
