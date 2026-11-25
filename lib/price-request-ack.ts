// Acuse «hemos recibido tu solicitud de presupuesto» (lib/quote-email.ts). Puro: textos por idioma del cliente.
// es y fr son los de siempre; en/de/pt llegan con la puerta nueva (idioma de la entrada).
import { plazoPresupuesto } from "./plazo-presupuesto.ts";

export const ACK_LANGS = ["es", "fr", "en", "de", "pt"] as const;
export type AckLang = (typeof ACK_LANGS)[number];

export const ackLangOf = (locale: string | null | undefined): AckLang => {
  const l = String(locale || "").trim().toLowerCase().slice(0, 2);
  return (ACK_LANGS as readonly string[]).includes(l) ? (l as AckLang) : "es";
};

type AckInput = { name: string; translatorLangName: string; askDeadline: boolean; recurrent: boolean; inReview: boolean; byJuan: boolean; plazo: string };

/** Nothing has gone to a juror yet: Juan reviews the request first. */
const REVIEW: Record<AckLang, string> = {
  es: "Hemos recibido tu solicitud de presupuesto. Juan la revisa personalmente antes de pasarla al traductor jurado que corresponda.\n",
  fr: "Nous avons bien reçu votre demande de devis. Juan l'examine personnellement avant de la confier au traducteur assermenté qui convient.\n",
  en: "We have received your quote request. Juan is reviewing it personally before passing it to the right sworn translator.\n",
  de: "wir haben Ihre Angebotsanfrage erhalten. Juan prüft sie persönlich, bevor er sie an den passenden vereidigten Übersetzer weitergibt.\n",
  pt: "Recebemos o seu pedido de orçamento. O Juan está a analisá-lo pessoalmente antes de o passar ao tradutor juramentado adequado.\n",
};

const AUTH: Record<AckLang, (maec: boolean) => string> = {
  es: (m) => `Será una traducción jurada oficial${m ? ", hecha por un traductor jurado nombrado por el MAEC" : ""}. Si la entrega es en PDF, lleva firma electrónica cualificada (certificado digital) verificable, y junto con la traducción te enviamos el enlace para comprobarla en «VALIDe», el servicio oficial del Gobierno de España: https://valide.redsara.es\n`,
  fr: (m) => `Ce sera une traduction assermentée officielle${m ? ", réalisée par un traducteur assermenté nommé par le MAEC" : ""}. Si la livraison se fait en PDF, elle porte une signature électronique qualifiée (certificat numérique) vérifiable, et nous vous envoyons avec la traduction le lien pour la vérifier sur « VALIDe », le service officiel du gouvernement espagnol : https://valide.redsara.es\n`,
  en: (m) => `It will be an official sworn translation${m ? ", done by a sworn translator appointed by the Spanish Ministry of Foreign Affairs (MAEC)" : ""}. If delivered as a PDF, it carries a verifiable qualified electronic signature (digital certificate), and together with the translation we send you the link to check it on "VALIDe", the official Spanish Government service: https://valide.redsara.es\n`,
  de: (m) => `Es wird eine offizielle beglaubigte Übersetzung${m ? ", angefertigt von einem vom spanischen Außenministerium (MAEC) ernannten vereidigten Übersetzer" : ""}. Bei Lieferung als PDF trägt sie eine überprüfbare qualifizierte elektronische Signatur (digitales Zertifikat), und zusammen mit der Übersetzung senden wir Ihnen den Link, um sie im offiziellen Dienst der spanischen Regierung «VALIDe» zu prüfen: https://valide.redsara.es\n`,
  pt: (m) => `Será uma tradução juramentada oficial${m ? ", feita por um tradutor juramentado nomeado pelo MAEC" : ""}. Se a entrega for em PDF, leva assinatura eletrónica qualificada (certificado digital) verificável, e junto com a tradução enviamos-lhe o link para a comprovar em «VALIDe», o serviço oficial do Governo de Espanha: https://valide.redsara.es\n`,
};

const TEXT: Record<AckLang, { subject: string; review: string; body(i: AckInput): string }> = {
  es: {
    subject: "Tu solicitud está en marcha — traduccionesjuradas.net",
    review: "Hemos recibido tu solicitud — traduccionesjuradas.net",
    body: (i) =>
      `Hola${i.name ? ` ${i.name}` : ""},\n` +
      (i.inReview ? REVIEW.es : `Hemos recibido tu solicitud de presupuesto y ya está en marcha: ${i.translatorLangName ? `tu documento ya está con un traductor jurado de ${i.translatorLangName} nombrado por el MAEC, que` : "un traductor jurado nombrado por el MAEC"} está estudiando tus documentos y preparando su propuesta.\n`) +
      "\n" + AUTH.es(i.inReview) + "\n" +
      `${i.byJuan ? "Te responde Juan Silva Moreno, traductor jurado nº 3850 (traduccionesjuradas.net)" : "Te respondemos desde traduccionesjuradas.net"}: recibirás el presupuesto con el precio y el plazo ${i.plazo}. No tienes que hacer nada más.\n` +
      (i.askDeadline ? "¿Tienes una fecha límite? Respóndenos a este correo con ella y ajustamos el plazo.\n" : "") +
      "Gracias por tu confianza." +
      (i.recurrent ? "\nHemos unido esta solicitud a tu historial con nosotros." : "") +
      `\n${i.byJuan ? "Traductor jurado MAEC nº 3850" : "traduccionesjuradas.net"}`,
  },
  fr: {
    subject: "Votre demande est en cours — traduccionesjuradas.net",
    review: "Nous avons bien reçu votre demande — traduccionesjuradas.net",
    body: (i) =>
      `Bonjour${i.name ? ` ${i.name}` : ""},\n` +
      (i.inReview ? REVIEW.fr : `Nous avons bien reçu votre demande de devis : ${i.translatorLangName ? `votre document est déjà entre les mains d'un traducteur assermenté (${i.translatorLangName}) nommé par le MAEC, qui` : "un traducteur assermenté nommé par le MAEC"} étudie vos documents et prépare sa proposition.\n`) +
      "\n" + AUTH.fr(i.inReview) + "\n" +
      `${i.byJuan ? "C'est Juan Silva Moreno, traducteur assermenté nº 3850 (traduccionesjuradas.net), qui vous répondra" : "Nous vous répondons depuis traduccionesjuradas.net"} : vous recevrez le devis avec le prix et le délai ${i.plazo}. Vous n'avez rien d'autre à faire.\n` +
      (i.askDeadline ? "Avez-vous une date limite ? Répondez-nous à ce message en l'indiquant et nous adapterons le délai.\n" : "") +
      "Merci de votre confiance." +
      (i.recurrent ? "\nNous avons rattaché cette demande à votre historique chez nous." : "") +
      `\n${i.byJuan ? "Traducteur assermenté MAEC nº 3850" : "traduccionesjuradas.net"}`,
  },
  en: {
    subject: "Your request is under way — traduccionesjuradas.net",
    review: "We have received your request — traduccionesjuradas.net",
    body: (i) =>
      `Hello${i.name ? ` ${i.name}` : ""},\n` +
      (i.inReview ? REVIEW.en : "We have received your quote request and it is already under way: a sworn translator appointed by the Spanish Ministry of Foreign Affairs (MAEC) is reviewing your documents and preparing the quote.\n") +
      "\n" + AUTH.en(i.inReview) + "\n" +
      `${i.byJuan ? "Juan Silva Moreno, sworn translator no. 3850 (traduccionesjuradas.net), will reply to you" : "We will reply to you from traduccionesjuradas.net"}: you will receive the quote with the price and the turnaround, ${i.plazo}. You do not need to do anything else.\n` +
      (i.askDeadline ? "Do you have a deadline? Reply to this email with the date and we will plan around it.\n" : "") +
      "Thank you for your trust." +
      (i.recurrent ? "\nWe have linked this request to your history with us." : "") +
      `\n${i.byJuan ? "Sworn translator MAEC no. 3850" : "traduccionesjuradas.net"}`,
  },
  de: {
    subject: "Ihre Anfrage ist in Bearbeitung — traduccionesjuradas.net",
    review: "Wir haben Ihre Anfrage erhalten — traduccionesjuradas.net",
    body: (i) =>
      `Guten Tag${i.name ? ` ${i.name}` : ""},\n` +
      (i.inReview ? REVIEW.de : "wir haben Ihre Angebotsanfrage erhalten und sie ist bereits in Bearbeitung: Ein vom spanischen Außenministerium (MAEC) ernannter vereidigter Übersetzer prüft Ihre Unterlagen und bereitet das Angebot vor.\n") +
      "\n" + AUTH.de(i.inReview) + "\n" +
      `${i.byJuan ? "Ihnen antwortet Juan Silva Moreno, vereidigter Übersetzer Nr. 3850 (traduccionesjuradas.net)" : "Wir antworten Ihnen von traduccionesjuradas.net aus"}: Sie erhalten das Angebot mit Preis und Lieferfrist ${i.plazo}. Sie müssen nichts weiter tun.\n` +
      (i.askDeadline ? "Haben Sie eine Frist? Antworten Sie uns auf diese E-Mail mit dem Datum, und wir richten die Lieferfrist danach.\n" : "") +
      "Vielen Dank für Ihr Vertrauen." +
      (i.recurrent ? "\nWir haben diese Anfrage mit Ihren früheren Aufträgen bei uns verknüpft." : "") +
      `\n${i.byJuan ? "Vereidigter Übersetzer MAEC Nr. 3850" : "traduccionesjuradas.net"}`,
  },
  pt: {
    subject: "O seu pedido está em andamento — traduccionesjuradas.net",
    review: "Recebemos o seu pedido — traduccionesjuradas.net",
    body: (i) =>
      `Olá${i.name ? ` ${i.name}` : ""},\n` +
      (i.inReview ? REVIEW.pt : "Recebemos o seu pedido de orçamento e já está em andamento: um tradutor juramentado nomeado pelo Ministério dos Negócios Estrangeiros de Espanha (MAEC) está a analisar os seus documentos e a preparar o orçamento.\n") +
      "\n" + AUTH.pt(i.inReview) + "\n" +
      `${i.byJuan ? "Quem lhe responde é Juan Silva Moreno, tradutor juramentado nº 3850 (traduccionesjuradas.net)" : "Respondemos-lhe a partir de traduccionesjuradas.net"}: receberá o orçamento com o preço e o prazo ${i.plazo}. Não precisa de fazer mais nada.\n` +
      (i.askDeadline ? "Tem uma data-limite? Responda a este e-mail com a data e ajustamos o prazo.\n" : "") +
      "Obrigado pela sua confiança." +
      (i.recurrent ? "\nAssociámos este pedido ao seu histórico connosco." : "") +
      `\n${i.byJuan ? "Tradutor juramentado MAEC nº 3850" : "traduccionesjuradas.net"}`,
  },
};

export function priceRequestAckText(lang: AckLang, i: { name?: string | null; translatorLangName?: string | null; askDeadline?: boolean; recurrent?: boolean; inReview?: boolean; byJuan?: boolean; now?: Date }) {
  const t = TEXT[lang];
  return {
    subject: i.inReview ? t.review : t.subject,
    body: t.body({
      name: (i.name || "").trim(),
      translatorLangName: (i.translatorLangName || "").trim().toLowerCase(),
      askDeadline: Boolean(i.askDeadline),
      recurrent: Boolean(i.recurrent),
      inReview: Boolean(i.inReview),
      byJuan: Boolean(i.byJuan),
      plazo: plazoPresupuesto(lang, Boolean(i.byJuan), i.now ?? new Date()),
    }),
  };
}

/** Juan solo traduce francés: true si algún idioma o par ("fr->es", "ES>FR") lo incluye. */
export const includesFrench = (...langs: Array<string | null | undefined>): boolean =>
  langs.some((l) => String(l || "").toLowerCase().split(/[^a-z]+/).includes("fr"));

/** Enlace «Ver tu solicitud» al área de cliente (URL firmada); vacío si no hay URL. */
const AREA_LINK: Record<AckLang, string> = {
  es: "Ver tu solicitud",
  fr: "Voir votre demande",
  en: "View your request",
  de: "Ihre Anfrage ansehen",
  pt: "Ver o seu pedido",
};

export const areaLinkLabel = (locale: string | null | undefined): string => AREA_LINK[ackLangOf(locale)];

export const ackAreaLine = (lang: AckLang, url: string | null | undefined): string => (url ? `${AREA_LINK[lang]}: ${url}` : "");
