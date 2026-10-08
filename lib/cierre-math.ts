// lib/cierre-math.ts — Decisiones PURAS del cierre con el cliente (orden de Juan,
// 8-oct-2026): envío automático del presupuesto al llegar el precio del jurado,
// recordatorio único a las 24 h, deducción del motivo de pérdida y alarma de
// coste. Sin imports de servidor para poder testearlo con node --test.

import { DIRECT_AUTO_MAX_CENTS } from "./lavori-directo-math.ts";
import { AUTO_LOST_NOTES, type AutoLostCode } from "./quote-lost-reasons.ts";
import { cardPayUrl } from "./quote-messages.ts";

/** Tope del envío automático: el mismo que el carril directo (300 € netos). */
export const AUTO_SEND_MAX_CENTS = DIRECT_AUTO_MAX_CENTS;
export const SEND_OVERDUE_HOURS = 2; // PRICED sin presupuesto enviado a las 2 h → «emitir» en el vigía
export const REMINDER_AFTER_HOURS = 24;
export const COST_GAP_AFTER_HOURS = 24;

const HOUR = 3_600_000;
const norm = (v: string | null | undefined) => String(v || "").trim().toLowerCase();

export const isFrPair = (s: string | null | undefined, t: string | null | undefined) => norm(s) === "fr" || norm(t) === "fr";
export const isPlaceholderAddr = (email: string | null | undefined) => /@whatsapp\.local$/i.test(email || "");
export const isRealEmail = (email: string | null | undefined) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") && !isPlaceholderAddr(email);

/* ───────────── (a) Envío automático ───────────── */

export type AutoSendInput = {
  sourceLang: string | null;
  targetLang: string | null;
  quoteStatus: string;
  sentAt: Date | null;
  sendingAt: Date | null;
  /** Neto tras descuento, en céntimos. */
  netCents: number;
  customerEmail: string | null;
  customerPhone: string | null;
  /** Detalle del freno de margen (checkQuoteLinesMargin) o null si pasa. */
  marginDetail: string | null;
  /** Alguna línea con precio y sin coste registrado: el freno de margen no la ve. */
  costMissing: boolean;
  heldByJuan: boolean;
  /** Otro encargo/presupuesto vivo del mismo contenido. */
  duplicate: string | null;
  /** El cliente ya pagó este encargo. */
  alreadyCustomer: string | null;
  /** Avisos que exigen ojo humano (precio anómalo, jurado no disponible…). */
  avisos?: string[];
};

export type AutoSendDecision =
  | { action: "send" }
  | { action: "skip"; reason: string } // ya enviado / en curso: ni se envía ni se avisa
  | { action: "alert"; reasons: string[] };

export function decideAutoSend(i: AutoSendInput): AutoSendDecision {
  // Idempotencia: solo un borrador virgen se envía. Cualquier otro estado, o un envío en
  // marcha, no se toca (el candado real está en finalizeAndSendQuote).
  if (i.quoteStatus !== "DRAFT" || i.sentAt) return { action: "skip", reason: `ya no es borrador (${i.quoteStatus})` };
  if (i.sendingAt) return { action: "skip", reason: "se está enviando" };

  const reasons: string[] = [];
  if (isFrPair(i.sourceLang, i.targetLang)) reasons.push("par FR: el francés es tuyo, lo envías tú");
  if (i.marginDetail) reasons.push(`no pasa el freno de margen: ${i.marginDetail}`);
  if (i.costMissing) reasons.push("hay líneas sin coste registrado: no se puede verificar el margen");
  if (i.netCents > AUTO_SEND_MAX_CENTS) reasons.push(`${(i.netCents / 100).toFixed(2)} € netos superan el tope de envío automático (${AUTO_SEND_MAX_CENTS / 100} €)`);
  const hasContact = isRealEmail(i.customerEmail) || String(i.customerPhone || "").replace(/\D/g, "").length >= 9;
  if (!hasContact) reasons.push("cliente sin identificar (ni email real ni teléfono)");
  else if (!isRealEmail(i.customerEmail)) reasons.push("cliente solo-WhatsApp: no hay email al que enviar, se manda a mano");
  if (i.heldByJuan) reasons.push("marcada «lo llevo yo» en lavori");
  if (i.duplicate) reasons.push(i.duplicate);
  if (i.alreadyCustomer) reasons.push(`el cliente ya pagó este encargo (${i.alreadyCustomer})`);
  for (const a of i.avisos || []) reasons.push(a);

  return reasons.length ? { action: "alert", reasons } : { action: "send" };
}

/* ───────────── (b) Recordatorio único ───────────── */

export const LINK_PREVIEW_UA =
  /WhatsApp|TelegramBot|facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|LinkedInBot|SkypeUriPreview|Googlebot|bingbot|Applebot|preview/i;

/** Apertura humana: algún AccessEvent cuyo user-agent no es una vista previa de enlace. */
export function hasHumanOpen(events: { userAgent: string | null }[]): boolean {
  return events.some((e) => !(e.userAgent && LINK_PREVIEW_UA.test(e.userAgent)));
}

export type ReminderInput = {
  status: string;
  sentAt: Date | null;
  now: Date;
  events: { userAgent: string | null }[];
  openedAt: Date | null;
  customerEmail: string | null;
  /** Ya hay un REMINDER (SENT o SKIPPED): nunca más de uno. */
  alreadyReminded: boolean;
};
export type ReminderDecision = "remind_email" | "whatsapp_task" | "none";

export function decideReminder(i: ReminderInput): ReminderDecision {
  if (i.alreadyReminded) return "none";
  if (!["SENT", "OPENED"].includes(i.status) || !i.sentAt) return "none";
  if (i.now.getTime() - i.sentAt.getTime() < REMINDER_AFTER_HOURS * HOUR) return "none";
  if (i.openedAt || hasHumanOpen(i.events)) return "none"; // lo abrió: no se le insiste
  return isPlaceholderAddr(i.customerEmail) ? "whatsapp_task" : "remind_email";
}

type RLang = "es" | "fr" | "en" | "de" | "pt" | "it";
const COPY: Record<RLang, { subject: (n: string) => string; body: (name: string, n: string, view: string, card: string | null) => string; wa: (name: string, n: string, view: string, card: string | null) => string }> = {
  es: {
    subject: (n) => `Su presupuesto ${n}`,
    body: (name, n, view, card) => `Hola ${name},\nLe escribo por si no vio el presupuesto ${n}: está listo para revisar.\nVerlo: ${view}${card ? `\nPagar con tarjeta: ${card}` : ""}\nCualquier duda, responda a este correo. – Juan Silva`,
    wa: (name, n, view, card) => `Hola ${name}, por si no lo viste: tu presupuesto ${n} está listo. Míralo aquí: ${view}${card ? ` · Pagar con tarjeta: ${card}` : ""}. Cualquier duda, dime.`,
  },
  fr: {
    subject: (n) => `Votre devis ${n}`,
    body: (name, n, view, card) => `Bonjour ${name},\nJe vous écris au cas où vous n'auriez pas vu le devis ${n} : il est prêt.\nLe consulter : ${view}${card ? `\nPayer par carte : ${card}` : ""}\nUne question ? Répondez à ce message. – Juan Silva`,
    wa: (name, n, view, card) => `Bonjour ${name}, au cas où vous ne l'auriez pas vu : votre devis ${n} est prêt. ${view}${card ? ` · Payer par carte : ${card}` : ""}`,
  },
  en: {
    subject: (n) => `Your quote ${n}`,
    body: (name, n, view, card) => `Hello ${name},\nIn case you missed it, quote ${n} is ready for you.\nView it: ${view}${card ? `\nPay by card: ${card}` : ""}\nAny question, just reply to this email. – Juan Silva`,
    wa: (name, n, view, card) => `Hi ${name}, in case you missed it: your quote ${n} is ready. ${view}${card ? ` · Pay by card: ${card}` : ""}`,
  },
  de: {
    subject: (n) => `Ihr Angebot ${n}`,
    body: (name, n, view, card) => `Guten Tag ${name},\nfalls Sie es übersehen haben: Das Angebot ${n} liegt für Sie bereit.\nAnsehen: ${view}${card ? `\nMit Karte zahlen: ${card}` : ""}\nBei Fragen antworten Sie einfach auf diese E-Mail. – Juan Silva`,
    wa: (name, n, view, card) => `Guten Tag ${name}, falls Sie es übersehen haben: Ihr Angebot ${n} ist bereit. ${view}${card ? ` · Mit Karte zahlen: ${card}` : ""}`,
  },
  pt: {
    subject: (n) => `O seu orçamento ${n}`,
    body: (name, n, view, card) => `Olá ${name},\nCaso não tenha visto, o orçamento ${n} está pronto.\nVer: ${view}${card ? `\nPagar com cartão: ${card}` : ""}\nQualquer dúvida, responda a este e-mail. – Juan Silva`,
    wa: (name, n, view, card) => `Olá ${name}, caso não tenha visto: o orçamento ${n} está pronto. ${view}${card ? ` · Pagar com cartão: ${card}` : ""}`,
  },
  it: {
    subject: (n) => `Il suo preventivo ${n}`,
    body: (name, n, view, card) => `Buongiorno ${name},\nse non l'ha visto, il preventivo ${n} è pronto.\nVisualizzarlo: ${view}${card ? `\nPagare con carta: ${card}` : ""}\nPer qualsiasi domanda risponda a questa email. – Juan Silva`,
    wa: (name, n, view, card) => `Buongiorno ${name}, se non l'ha visto: il preventivo ${n} è pronto. ${view}${card ? ` · Pagare con carta: ${card}` : ""}`,
  },
};

type CopyOpts = { lang: string | null | undefined; name: string; quoteNumber: string; payUrl: string };
const copyFor = (lang: string | null | undefined) => COPY[(norm(lang) in COPY ? norm(lang) : "es") as RLang];

export function buildCierreReminder(o: CopyOpts) {
  const c = copyFor(o.lang);
  return { subject: c.subject(o.quoteNumber), body: c.body(o.name || "", o.quoteNumber, o.payUrl, cardPayUrl(o.payUrl)) };
}

/** Texto listo para copiar en WhatsApp (cliente solo-WhatsApp que no abrió el presupuesto). */
export function whatsappNudgeText(o: CopyOpts) {
  return copyFor(o.lang).wa(o.name || "", o.quoteNumber, o.payUrl, cardPayUrl(o.payUrl));
}

/* ───────────── (c) Motivo de pérdida y coste ───────────── */

/** NOT_OPENED / REPLACED si se pueden deducir; null si lo abrió y no pagó (decide Juan). */
export function deduceLostReason(i: { replacedByPaid: boolean; humanOpened: boolean }): AutoLostCode | null {
  if (i.replacedByPaid) return "REPLACED";
  if (!i.humanOpened) return "NOT_OPENED";
  return null;
}
export const autoLostNote = (c: AutoLostCode) => AUTO_LOST_NOTES[c];

export type CostGapOrder = {
  paymentStatus: string;
  status: string;
  paidAt: Date | null;
  langPair: string | null;
  assignedTo: string | null;
  supplierCostCents: number | null;
  assignments: { isWinning: boolean; status: string; quotedPriceCents: number | null }[];
};

/**
 * Pedido pagado hace ≥24 h sin coste: ni supplierCostCents ni asignación ganadora con precio.
 * El francés propio (sin asignar o asignado a Juan) cuenta como coste 0 explícito, no como hueco.
 * supplierCostCents = 0 es un coste explícito.
 */
export function hasCostGap(o: CostGapOrder, now: Date): boolean {
  if (o.paymentStatus !== "PAID" || !o.paidAt || o.status === "CANCELLED") return false;
  if (now.getTime() - o.paidAt.getTime() < COST_GAP_AFTER_HOURS * HOUR) return false;
  if (o.supplierCostCents != null) return false;
  if (o.assignments.some((a) => (a.isWinning || a.status === "ACCEPTED") && a.quotedPriceCents != null)) return false;
  const fr = norm(o.langPair).split(/->|>|-/).includes("fr");
  const own = !o.assignedTo || /juan/i.test(o.assignedTo);
  return !(fr && own);
}
