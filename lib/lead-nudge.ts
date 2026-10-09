// lib/lead-nudge.ts — lógica PURA (sin BD ni alias) del aviso a 5 min a leads de
// la puerta que vieron precio y no pagaron (orden de Juan, 6-oct-2026), y del
// token firmado del enlace «revisar a mano». Sin imports con alias para poder
// probarla con node --test.

import crypto from "node:crypto";

export type NudgeLocale = "es" | "fr" | "en" | "de" | "pt";

export type NudgeRow = {
  id: string;
  clientEmail: string | null;
  clientName: string | null;
  clientPhone?: string | null;
  sessionToken: string | null;
  fileName: string;
  documentType: string | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  estimatedWords: number | null;
  quoteAmount: number | null;
  orderReference?: string | null;
  createdAt: Date;
};

export type NudgeGroup = {
  email: string;
  sessionToken: string;
  clientName: string | null;
  rows: NudgeRow[];
  orderReference: string | null;
};

/** Agrupa por email (una persona = un aviso) y se queda con los documentos de su sesión más reciente. */
export function groupNudgeLeads(rows: NudgeRow[], isExcludedEmail: (email: string) => boolean): NudgeGroup[] {
  const byEmail = new Map<string, NudgeRow[]>();
  for (const r of rows) {
    const email = (r.clientEmail || "").trim().toLowerCase();
    const tok = r.sessionToken || "";
    if (!email || !tok || tok.startsWith("exp:") || tok.startsWith("staff:")) continue;
    if (!(Number(r.quoteAmount) > 0)) continue;
    if (isExcludedEmail(email)) continue;
    const g = byEmail.get(email);
    if (g) g.push(r);
    else byEmail.set(email, [r]);
  }
  const out: NudgeGroup[] = [];
  for (const [email, list] of byEmail) {
    const latest = list.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
    const sessionRows = list
      .filter((r) => r.sessionToken === latest.sessionToken)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    out.push({
      email,
      sessionToken: latest.sessionToken!,
      clientName: sessionRows.find((r) => r.clientName)?.clientName ?? null,
      rows: sessionRows,
      orderReference: sessionRows.find((r) => r.orderReference)?.orderReference ?? null,
    });
  }
  return out;
}

export type NudgeContext = {
  email: string;
  sessionToken: string;
  paidOrderLast24h: boolean;
  // Documentos del mismo email en las últimas 24 h (cualquier sesión).
  recentDocs: { sessionToken: string | null; orderId: string | null }[];
  // LavoriPriceRequest del email (por customerHint) o del expediente, últimas 24 h.
  priceRequests: { status: string; customerHint: string | null; expedienteRef: string | null }[];
};

const LIVE_REQUEST = new Set(["SENT", "PRICED", "ACCEPTED"]);

/** Devuelve el motivo para NO avisar, o null si se puede avisar. */
export function nudgeSkipReason(ctx: NudgeContext): string | null {
  const email = ctx.email.toLowerCase();
  if (ctx.paidOrderLast24h) return "paid";
  if (ctx.recentDocs.some((d) => d.orderId)) return "ordered";
  if (ctx.recentDocs.some((d) => (d.sessionToken || "").startsWith("exp:"))) return "expediente";
  for (const r of ctx.priceRequests) {
    if (!LIVE_REQUEST.has(r.status)) continue;
    if ((r.customerHint || "").toLowerCase().includes(email)) return "price-request";
    if (r.expedienteRef === `puerta:${ctx.sessionToken}`) return "price-request";
    if ((r.expedienteRef || "").toLowerCase().startsWith("exp") && (r.customerHint || "").toLowerCase().includes(email)) return "price-request";
  }
  // La solicitud desde la puerta guarda expedienteRef=puerta:<token> aunque esté en otro estado.
  if (ctx.priceRequests.some((r) => r.expedienteRef === `puerta:${ctx.sessionToken}`)) return "requested";
  return null;
}

/* ---------------------------- token firmado ---------------------------- */

export const REVIEW_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type ReviewPayload = { s: string; l: NudgeLocale; exp: number };

function sig(secret: string, b64: string) {
  return crypto.createHmac("sha256", secret).update(`revisar:${b64}`).digest("base64url");
}

export function createReviewToken(secret: string, sessionToken: string, locale: NudgeLocale, now = Date.now()): string {
  if (!secret) throw new Error("secret requerido");
  const b64 = Buffer.from(JSON.stringify({ s: sessionToken, l: locale, exp: now + REVIEW_TOKEN_TTL_MS } satisfies ReviewPayload)).toString("base64url");
  return `${b64}.${sig(secret, b64)}`;
}

export function verifyReviewToken(secret: string, token: string | null | undefined, now = Date.now()): { sessionToken: string; locale: NudgeLocale } | null {
  if (!secret || !token) return null;
  const [b64, s] = token.split(".");
  if (!b64 || !s) return null;
  const expected = sig(secret, b64);
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as ReviewPayload;
    if (!p || typeof p.s !== "string" || !p.s || typeof p.exp !== "number" || p.exp < now) return null;
    const l: NudgeLocale = ["es", "fr", "en", "de", "pt"].includes(p.l) ? p.l : "es";
    return { sessionToken: p.s, locale: l };
  } catch {
    return null;
  }
}

/* -------------------------------- textos ------------------------------- */

export type NudgeCopy = {
  subject: string;
  hello: (name: string | null) => string;
  intro: (n: number) => string;
  vatIncl: string;
  priceTbc: string;
  dontForget: string;
  resume: string;
  reviewLead: string;
  reviewBtn: string;
  whatsapp: string;
  ignore: string;
  signature: string;
  pageTitle: string;
  pageBody: string;
  pageInvalid: string;
};

const SIGN = "Juan Silva Moreno<br/>Traductor-Intérprete Jurado (MAEC nº 3850)";

export const NUDGE_COPY: Record<NudgeLocale, NudgeCopy> = {
  es: {
    subject: "No olvide finalizar su pedido de traducción jurada",
    hello: (n) => (n ? `Hola ${n},` : "Hola,"),
    intro: (n) => `Ha subido ${n === 1 ? "un documento" : "sus documentos"} para una traducción jurada y su presupuesto está listo:`,
    vatIncl: "IVA incluido",
    priceTbc: "precio a confirmar por su traductor jurado",
    dontForget: "No olvide finalizar su pedido",
    resume: "Finalizar mi pedido",
    reviewLead: "¿Quiere que revisemos su presupuesto a mano?",
    reviewBtn: "Haga clic aquí",
    whatsapp: "¿Prefiere hablar? WhatsApp 951 333 614",
    ignore: "Si ya no lo necesita, ignore este correo.",
    signature: SIGN,
    pageTitle: "Recibido",
    pageBody: "Un traductor jurado revisa su presupuesto y le escribe hoy.",
    pageInvalid: "Este enlace no es válido o ha caducado. Escríbanos por WhatsApp al 951 333 614.",
  },
  fr: {
    subject: "N'oubliez pas de finaliser votre commande de traduction assermentée",
    hello: (n) => (n ? `Bonjour ${n},` : "Bonjour,"),
    intro: (n) => `Vous avez téléversé ${n === 1 ? "un document" : "vos documents"} pour une traduction assermentée et votre devis est prêt :`,
    vatIncl: "TVA incluse",
    priceTbc: "prix à confirmer par votre traducteur assermenté",
    dontForget: "N'oubliez pas de finaliser votre commande",
    resume: "Finaliser ma commande",
    reviewLead: "Souhaitez-vous que nous révisions votre devis à la main ?",
    reviewBtn: "Cliquez ici",
    whatsapp: "Vous préférez en parler ? WhatsApp +34 951 333 614",
    ignore: "Si vous n'en avez plus besoin, ignorez simplement ce message.",
    signature: "Juan Silva Moreno<br/>Traducteur-Interprète Juré (MAEC n° 3850)",
    pageTitle: "Bien reçu",
    pageBody: "Un traducteur assermenté examine votre devis et vous écrit aujourd'hui.",
    pageInvalid: "Ce lien n'est pas valide ou a expiré. Écrivez-nous sur WhatsApp au +34 951 333 614.",
  },
  en: {
    subject: "Don't forget to complete your certified translation order",
    hello: (n) => (n ? `Hello ${n},` : "Hello,"),
    intro: (n) => `You uploaded ${n === 1 ? "a document" : "your documents"} for a certified translation and your quote is ready:`,
    vatIncl: "VAT included",
    priceTbc: "price to be confirmed by your sworn translator",
    dontForget: "Don't forget to complete your order",
    resume: "Complete my order",
    reviewLead: "Would you like us to review your quote by hand?",
    reviewBtn: "Click here",
    whatsapp: "Prefer to talk? WhatsApp +34 951 333 614",
    ignore: "If you no longer need it, simply ignore this email.",
    signature: "Juan Silva Moreno<br/>Sworn Translator-Interpreter (MAEC no. 3850)",
    pageTitle: "Received",
    pageBody: "A sworn translator is reviewing your quote and will write to you today.",
    pageInvalid: "This link is invalid or has expired. Message us on WhatsApp at +34 951 333 614.",
  },
  de: {
    subject: "Vergessen Sie nicht, Ihre Bestellung der beglaubigten Übersetzung abzuschließen",
    hello: (n) => (n ? `Guten Tag ${n},` : "Guten Tag,"),
    intro: (n) => `Sie haben ${n === 1 ? "ein Dokument" : "Ihre Dokumente"} für eine beglaubigte Übersetzung hochgeladen, und Ihr Angebot liegt bereit:`,
    vatIncl: "inkl. MwSt.",
    priceTbc: "Preis wird von Ihrem vereidigten Übersetzer bestätigt",
    dontForget: "Vergessen Sie nicht, Ihre Bestellung abzuschließen",
    resume: "Bestellung abschließen",
    reviewLead: "Möchten Sie, dass wir Ihr Angebot persönlich prüfen?",
    reviewBtn: "Hier klicken",
    whatsapp: "Lieber sprechen? WhatsApp +34 951 333 614",
    ignore: "Wenn Sie es nicht mehr benötigen, ignorieren Sie diese E-Mail einfach.",
    signature: "Juan Silva Moreno<br/>Vereidigter Übersetzer und Dolmetscher (MAEC Nr. 3850)",
    pageTitle: "Eingegangen",
    pageBody: "Ein vereidigter Übersetzer prüft Ihr Angebot und schreibt Ihnen heute.",
    pageInvalid: "Dieser Link ist ungültig oder abgelaufen. Schreiben Sie uns per WhatsApp: +34 951 333 614.",
  },
  pt: {
    subject: "Não se esqueça de finalizar o seu pedido de tradução juramentada",
    hello: (n) => (n ? `Olá ${n},` : "Olá,"),
    intro: (n) => `Enviou ${n === 1 ? "um documento" : "os seus documentos"} para uma tradução juramentada e o seu orçamento está pronto:`,
    vatIncl: "IVA incluído",
    priceTbc: "preço a confirmar pelo seu tradutor juramentado",
    dontForget: "Não se esqueça de finalizar o seu pedido",
    resume: "Finalizar o meu pedido",
    reviewLead: "Quer que revejamos o seu orçamento manualmente?",
    reviewBtn: "Clique aqui",
    whatsapp: "Prefere falar? WhatsApp +34 951 333 614",
    ignore: "Se já não precisar, ignore simplesmente este email.",
    signature: "Juan Silva Moreno<br/>Tradutor-Intérprete Juramentado (MAEC n.º 3850)",
    pageTitle: "Recebido",
    pageBody: "Um tradutor juramentado está a rever o seu orçamento e escreve-lhe hoje.",
    pageInvalid: "Esta ligação não é válida ou expirou. Escreva-nos por WhatsApp: +34 951 333 614.",
  },
};
