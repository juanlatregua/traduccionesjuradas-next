// lib/cierre-math.ts — Decisiones PURAS del cierre con el cliente (orden de Juan,
// 8-oct-2026): envío automático del presupuesto al llegar el precio del jurado,
// recordatorio único a las 24 h, deducción del motivo de pérdida y alarma de
// coste. Sin imports de servidor para poder testearlo con node --test.

import { DIRECT_AUTO_MAX_CENTS } from "./lavori-directo-math.ts";
import { AUTO_LOST_NOTES, type AutoLostCode } from "./quote-lost-reasons.ts";
import { cardPayUrl } from "./quote-messages.ts";
import { CASA_LANGS } from "./lavori-bridge.ts";
import { PAYMENT_ACCOUNTS } from "./payment-labels.ts";

/** Tope del envío automático: el mismo que el carril directo (300 € netos). */
export const AUTO_SEND_MAX_CENTS = DIRECT_AUTO_MAX_CENTS;
export const SEND_OVERDUE_HOURS = 2; // PRICED sin presupuesto enviado a las 2 h → «emitir» en el vigía
export const REMINDER_AFTER_HOURS = 24;
export const COST_GAP_AFTER_HOURS = 24;

const HOUR = 3_600_000;
const norm = (v: string | null | undefined) => String(v || "").trim().toLowerCase();
const normName = (v: string | null | undefined) => norm(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

/** Mismo traductor por nombre normalizado EXACTO (no por tokens): decide si cambió el traductor. */
export const sameTranslatorExact = (a: string | null | undefined, b: string | null | undefined) => !!normName(a) && normName(a) === normName(b);

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
  /** El cliente ya escribió o dijo que no (respuesta-guard): el borrador queda sin enviar. */
  clientSaidNo?: string | null;
  /** Avisos que exigen ojo humano (precio anómalo, jurado no disponible…). */
  avisos?: string[];
  /** Par de la solicitud a lavori («DE>ES»). Si se informa y no es el del presupuesto, no sale solo. */
  leadPar?: string | null;
};

/** «DE>ES», «de-es», «de→es» → «de>es»; null si no son dos idiomas. */
export function normalizePair(a: string | null | undefined, b?: string | null): string | null {
  const parts = b === undefined ? String(a || "").trim().toLowerCase().split(/\s*(?:->|→|>|-)\s*/) : [norm(a), norm(b)];
  return parts.length === 2 && parts[0] && parts[1] ? `${parts[0]}>${parts[1]}` : null;
}

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
  if (i.leadPar != null) {
    const lead = normalizePair(i.leadPar);
    const quote = normalizePair(i.sourceLang, i.targetLang);
    if (!lead || !quote || lead !== quote) reasons.push(`el par de la solicitud (${i.leadPar}) no coincide con el del presupuesto (${i.sourceLang || "?"}>${i.targetLang || "?"})`);
  }
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
  if (i.clientSaidNo) reasons.push(i.clientSaidNo);
  for (const a of i.avisos || []) reasons.push(a);

  return reasons.length ? { action: "alert", reasons } : { action: "send" };
}

/* ───────────── (b) Segundo contacto a las 24 h y cierre suave ───────────── */
// Regla de Juan (9-oct-2026): «2º contacto a las 24 h; si no responde, adiós». A las 24 h
// de sentAt TODO presupuesto sin pagar recibe UN segundo contacto; 24 h después, cierre
// suave (lostReason NO_LONGER_NEEDED + marca auto:sin_respuesta) SIN pasar a EXPIRED, para
// que pueda pagar si vuelve dentro de validUntil.

export const NO_RESPONSE_NOTE = AUTO_LOST_NOTES.NO_RESPONSE;
export const CLOSE_AFTER_HOURS = 24; // tras el 2º contacto
export const RETRY_FAILED_AFTER_HOURS = 20; // el cron corre 4×/día: un FAILED reciente no se reintenta

export const LINK_PREVIEW_UA =
  /WhatsApp|TelegramBot|facebookexternalhit|Facebot|Twitterbot|Slackbot|Discordbot|LinkedInBot|SkypeUriPreview|Googlebot|bingbot|Applebot|preview/i;

/** Apertura humana: algún AccessEvent cuyo user-agent no es una vista previa de enlace. */
export function hasHumanOpen(events: { userAgent: string | null }[]): boolean {
  return events.some((e) => !(e.userAgent && LINK_PREVIEW_UA.test(e.userAgent)));
}

export type FollowUpInput = {
  status: string;
  sentAt: Date | null;
  now: Date;
  events: { userAgent: string | null }[];
  openedAt: Date | null;
  customerEmail: string | null;
  paidAt?: Date | null;
  /** Cuándo salió el 2º contacto (REMINDER SENT; en solo-WhatsApp, el WhatsApp marcado «Ya lo traté»); null si no consta. */
  reminderSentAt: Date | null;
  /** Hay un REMINDER SKIPPED (ya es cliente): ni se escribe ni se cierra. */
  reminderSkipped: boolean;
  /** Último intento REMINDER FAILED, si lo hay. */
  lastFailedAt: Date | null;
};
export type FollowUpDecision = { action: "none" | "remind_email" | "remind_accepted" | "whatsapp_task" | "close"; opened: boolean };

export function decideFollowUp(i: FollowUpInput): FollowUpDecision {
  const none = { action: "none" as const, opened: false };
  if (i.paidAt || !["SENT", "OPENED", "ACCEPTED"].includes(i.status) || !i.sentAt) return none;
  if (i.status === "ACCEPTED") {
    // Abrió el pago y no lo completó: UN solo aviso; el cron no cierra ACCEPTED ni lo recuerda dos veces.
    const held = { ...none, opened: true };
    if (i.reminderSkipped || i.reminderSentAt) return held;
    if (i.now.getTime() - i.sentAt.getTime() < REMINDER_AFTER_HOURS * HOUR) return held;
    if (isPlaceholderAddr(i.customerEmail)) return { action: "whatsapp_task", opened: true };
    if (i.lastFailedAt && i.now.getTime() - i.lastFailedAt.getTime() < RETRY_FAILED_AFTER_HOURS * HOUR) return held;
    return { action: "remind_accepted", opened: true };
  }
  const opened = i.status !== "SENT" || Boolean(i.openedAt) || hasHumanOpen(i.events);
  if (i.reminderSkipped) return { ...none, opened };
  const age = i.now.getTime() - i.sentAt.getTime();
  if (i.reminderSentAt) {
    return { action: i.now.getTime() - i.reminderSentAt.getTime() >= CLOSE_AFTER_HOURS * HOUR ? "close" : "none", opened };
  }
  if (isPlaceholderAddr(i.customerEmail)) {
    // Sin email: el 2º contacto es la tarea del vigía (WhatsApp a mano, abra o no). Sin constancia
    // de que Juan lo hizo («Ya lo traté»), NUNCA se cierra solo.
    return { action: age >= REMINDER_AFTER_HOURS * HOUR ? "whatsapp_task" : "none", opened };
  }
  if (age < REMINDER_AFTER_HOURS * HOUR) return { action: "none", opened };
  if (i.lastFailedAt && i.now.getTime() - i.lastFailedAt.getTime() < RETRY_FAILED_AFTER_HOURS * HOUR) return { action: "none", opened };
  return { action: "remind_email", opened };
}

type RLang = "es" | "fr" | "en" | "de" | "pt" | "it";
const COPY: Record<RLang, { subject: (n: string) => string; opened: (name: string, n: string, view: string, card: string | null) => string; body: (name: string, n: string, view: string, card: string | null) => string; wa: (name: string, n: string, view: string, card: string | null) => string }> = {
  es: {
    opened: (name, n, view, card) => `Hola ${name},\n¿Te ayudo a terminar el pedido del presupuesto ${n}? Puedes pagar directamente aquí: ${card || view}\nSi tienes cualquier duda, responde a este correo. – Juan Silva`,
    subject: (n) => `Su presupuesto ${n}`,
    body: (name, n, view, card) => `Hola ${name},\nLe escribo por si no vio el presupuesto ${n}: está listo para revisar.\nVerlo: ${view}${card ? `\nPagar con tarjeta: ${card}` : ""}\nCualquier duda, responda a este correo. – Juan Silva`,
    wa: (name, n, view, card) => `Hola ${name}, por si no lo viste: tu presupuesto ${n} está listo. Míralo aquí: ${view}${card ? ` · Pagar con tarjeta: ${card}` : ""}. Cualquier duda, dime.`,
  },
  fr: {
    opened: (name, n, view, card) => `Bonjour ${name},\nPuis-je vous aider à finaliser votre commande (devis ${n}) ? Vous pouvez payer directement ici : ${card || view}\nUne question ? Répondez à ce message. – Juan Silva`,
    subject: (n) => `Votre devis ${n}`,
    body: (name, n, view, card) => `Bonjour ${name},\nJe vous écris au cas où vous n'auriez pas vu le devis ${n} : il est prêt.\nLe consulter : ${view}${card ? `\nPayer par carte : ${card}` : ""}\nUne question ? Répondez à ce message. – Juan Silva`,
    wa: (name, n, view, card) => `Bonjour ${name}, au cas où vous ne l'auriez pas vu : votre devis ${n} est prêt. ${view}${card ? ` · Payer par carte : ${card}` : ""}`,
  },
  en: {
    opened: (name, n, view, card) => `Hello ${name},\nCan I help you finish your order (quote ${n})? You can pay directly here: ${card || view}\nAny question, just reply to this email. – Juan Silva`,
    subject: (n) => `Your quote ${n}`,
    body: (name, n, view, card) => `Hello ${name},\nIn case you missed it, quote ${n} is ready for you.\nView it: ${view}${card ? `\nPay by card: ${card}` : ""}\nAny question, just reply to this email. – Juan Silva`,
    wa: (name, n, view, card) => `Hi ${name}, in case you missed it: your quote ${n} is ready. ${view}${card ? ` · Pay by card: ${card}` : ""}`,
  },
  de: {
    opened: (name, n, view, card) => `Guten Tag ${name},\nKann ich Ihnen helfen, die Bestellung (Angebot ${n}) abzuschließen? Sie können direkt hier bezahlen: ${card || view}\nBei Fragen antworten Sie einfach auf diese E-Mail. – Juan Silva`,
    subject: (n) => `Ihr Angebot ${n}`,
    body: (name, n, view, card) => `Guten Tag ${name},\nfalls Sie es übersehen haben: Das Angebot ${n} liegt für Sie bereit.\nAnsehen: ${view}${card ? `\nMit Karte zahlen: ${card}` : ""}\nBei Fragen antworten Sie einfach auf diese E-Mail. – Juan Silva`,
    wa: (name, n, view, card) => `Guten Tag ${name}, falls Sie es übersehen haben: Ihr Angebot ${n} ist bereit. ${view}${card ? ` · Mit Karte zahlen: ${card}` : ""}`,
  },
  pt: {
    opened: (name, n, view, card) => `Olá ${name},\nPosso ajudá-lo a concluir o pedido (orçamento ${n})? Pode pagar diretamente aqui: ${card || view}\nQualquer dúvida, responda a este e-mail. – Juan Silva`,
    subject: (n) => `O seu orçamento ${n}`,
    body: (name, n, view, card) => `Olá ${name},\nCaso não tenha visto, o orçamento ${n} está pronto.\nVer: ${view}${card ? `\nPagar com cartão: ${card}` : ""}\nQualquer dúvida, responda a este e-mail. – Juan Silva`,
    wa: (name, n, view, card) => `Olá ${name}, caso não tenha visto: o orçamento ${n} está pronto. ${view}${card ? ` · Pagar com cartão: ${card}` : ""}`,
  },
  it: {
    opened: (name, n, view, card) => `Buongiorno ${name},\nPosso aiutarla a completare l'ordine (preventivo ${n})? Può pagare direttamente qui: ${card || view}\nPer qualsiasi domanda risponda a questa email. – Juan Silva`,
    subject: (n) => `Il suo preventivo ${n}`,
    body: (name, n, view, card) => `Buongiorno ${name},\nse non l'ha visto, il preventivo ${n} è pronto.\nVisualizzarlo: ${view}${card ? `\nPagare con carta: ${card}` : ""}\nPer qualsiasi domanda risponda a questa email. – Juan Silva`,
    wa: (name, n, view, card) => `Buongiorno ${name}, se non l'ha visto: il preventivo ${n} è pronto. ${view}${card ? ` · Pagare con carta: ${card}` : ""}`,
  },
};

const ACCEPTED_COPY: Record<RLang, { subject: (n: string) => string; body: (name: string, n: string, total: string, link: string, bizum: string) => string }> = {
  es: {
    subject: (n) => `Su presupuesto ${n}: ¿algún problema con el pago?`,
    body: (name, n, total, link, bizum) => `Hola ${name}:\n\nHemos visto que intentó pagar el presupuesto ${n} (${total} €, IVA incluido) y el pago no llegó a completarse. ¿Tuvo algún problema con la tarjeta?\n\nPuede volver a intentarlo aquí: ${link}\n\nSi le resulta más cómodo, también puede pagar por Bizum al ${bizum} o por transferencia, indicando el número ${n}. Respóndanos y le pasamos los datos.\n\n¿Para qué fecha lo necesita? Así le confirmamos el plazo de entrega.\n\nUn saludo,\nJuan Silva Moreno · traductor jurado nº 3850 · traduccionesjuradas.net`,
  },
  fr: {
    subject: (n) => `Votre devis ${n} : un problème de paiement ?`,
    body: (name, n, total, link, bizum) => `Bonjour ${name},\n\nNous avons vu que vous avez tenté de payer le devis ${n} (${total} €, TVA incluse) et que le paiement n'a pas abouti. Avez-vous eu un problème avec la carte ?\n\nVous pouvez réessayer ici : ${link}\n\nSi c'est plus simple, vous pouvez aussi payer par Bizum au ${bizum} ou par virement, en indiquant le numéro ${n}. Répondez-nous et nous vous enverrons les coordonnées.\n\nPour quelle date en avez-vous besoin ? Nous vous confirmerons ainsi le délai de livraison.\n\nCordialement,\nJuan Silva Moreno · traducteur juré n° 3850 · traduccionesjuradas.net`,
  },
  en: {
    subject: (n) => `Your quote ${n}: any problem with the payment?`,
    body: (name, n, total, link, bizum) => `Hello ${name},\n\nWe saw that you tried to pay quote ${n} (€${total}, VAT included) and the payment did not go through. Did you have a problem with your card?\n\nYou can try again here: ${link}\n\nIf it is easier, you can also pay by Bizum to ${bizum} or by bank transfer, quoting number ${n}. Reply and we will send you the details.\n\nBy what date do you need it? That way we can confirm the delivery time.\n\nKind regards,\nJuan Silva Moreno · sworn translator no. 3850 · traduccionesjuradas.net`,
  },
  de: {
    subject: (n) => `Ihr Angebot ${n}: Problem mit der Zahlung?`,
    body: (name, n, total, link, bizum) => `Guten Tag ${name},\n\nwir haben gesehen, dass Sie versucht haben, das Angebot ${n} (${total} €, inkl. MwSt.) zu bezahlen, die Zahlung wurde jedoch nicht abgeschlossen. Gab es ein Problem mit der Karte?\n\nSie können es hier erneut versuchen: ${link}\n\nWenn es für Sie einfacher ist, können Sie auch per Bizum an ${bizum} oder per Überweisung zahlen, mit Angabe der Nummer ${n}. Antworten Sie uns, dann senden wir Ihnen die Daten.\n\nBis wann benötigen Sie die Übersetzung? So können wir die Lieferzeit bestätigen.\n\nMit freundlichen Grüßen\nJuan Silva Moreno · vereidigter Übersetzer Nr. 3850 · traduccionesjuradas.net`,
  },
  pt: {
    subject: (n) => `O seu orçamento ${n}: algum problema com o pagamento?`,
    body: (name, n, total, link, bizum) => `Olá ${name},\n\nVimos que tentou pagar o orçamento ${n} (${total} €, IVA incluído) e o pagamento não chegou a concluir-se. Teve algum problema com o cartão?\n\nPode tentar de novo aqui: ${link}\n\nSe for mais cómodo, também pode pagar por Bizum para o ${bizum} ou por transferência, indicando o número ${n}. Responda-nos e enviamos os dados.\n\nPara que data precisa da tradução? Assim confirmamos o prazo de entrega.\n\nCumprimentos,\nJuan Silva Moreno · tradutor juramentado n.º 3850 · traduccionesjuradas.net`,
  },
  it: {
    subject: (n) => `Il suo preventivo ${n}: qualche problema con il pagamento?`,
    body: (name, n, total, link, bizum) => `Buongiorno ${name},\n\nabbiamo visto che ha provato a pagare il preventivo ${n} (${total} €, IVA inclusa) e il pagamento non è stato completato. Ha avuto un problema con la carta?\n\nPuò riprovare qui: ${link}\n\nSe preferisce, può anche pagare con Bizum al ${bizum} o con bonifico, indicando il numero ${n}. Ci risponda e le inviamo i dati.\n\nPer quale data le serve? Così le confermiamo il termine di consegna.\n\nCordiali saluti,\nJuan Silva Moreno · traduttore giurato n. 3850 · traduccionesjuradas.net`,
  },
};

/** Aviso único al cliente que abrió el pago (ACCEPTED) y no lo completó. */
export function buildAcceptedReminder(o: { lang: string | null | undefined; name: string; quoteNumber: string; totalEur: number; payUrl: string }) {
  const c = ACCEPTED_COPY[(norm(o.lang) in ACCEPTED_COPY ? norm(o.lang) : "es") as RLang];
  const acc = PAYMENT_ACCOUNTS.bizum654;
  const bizum = acc.kind === "bizum" ? acc.phone : "";
  const total = o.totalEur.toFixed(2).replace(".", ",");
  return { subject: c.subject(o.quoteNumber), body: c.body(o.name || "", o.quoteNumber, total, o.payUrl, bizum) };
}

/** Texto de WhatsApp del 2º contacto para quien ya abrió el presupuesto. */
const WA_OPENED: Record<RLang, (name: string, n: string, card: string) => string> = {
  es: (name, n, card) => `Hola ${name}, ¿te ayudo a terminar el pedido del presupuesto ${n}? Puedes pagar directamente aquí: ${card}`,
  fr: (name, n, card) => `Bonjour ${name}, puis-je vous aider à finaliser votre commande (devis ${n}) ? Paiement direct : ${card}`,
  en: (name, n, card) => `Hi ${name}, can I help you finish your order (quote ${n})? You can pay directly here: ${card}`,
  de: (name, n, card) => `Guten Tag ${name}, kann ich Ihnen helfen, die Bestellung (Angebot ${n}) abzuschließen? Direkt bezahlen: ${card}`,
  pt: (name, n, card) => `Olá ${name}, posso ajudá-lo a concluir o pedido (orçamento ${n})? Pagamento direto: ${card}`,
  it: (name, n, card) => `Buongiorno ${name}, posso aiutarla a completare l'ordine (preventivo ${n})? Pagamento diretto: ${card}`,
};

type CopyOpts = { lang: string | null | undefined; name: string; quoteNumber: string; payUrl: string; /** Lo abrió o aceptó: «¿te ayudo a terminar?» en vez de «¿lo recibiste?». */ opened?: boolean };
const copyFor = (lang: string | null | undefined) => COPY[(norm(lang) in COPY ? norm(lang) : "es") as RLang];

export function buildCierreReminder(o: CopyOpts) {
  const c = copyFor(o.lang);
  const card = cardPayUrl(o.payUrl);
  return { subject: c.subject(o.quoteNumber), body: (o.opened ? c.opened : c.body)(o.name || "", o.quoteNumber, o.payUrl, card) };
}

/** Texto listo para copiar en WhatsApp (cliente solo-WhatsApp que no abrió el presupuesto). */
export function whatsappNudgeText(o: CopyOpts) {
  if (o.opened) return WA_OPENED[(norm(o.lang) in WA_OPENED ? norm(o.lang) : "es") as RLang](o.name || "", o.quoteNumber, cardPayUrl(o.payUrl) || o.payUrl);
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
 * El francés propio (sin asignar o asignado a Juan Silva) cuenta como coste 0 explícito, no como hueco.
 * supplierCostCents = 0 es un coste explícito.
 */
export function hasCostGap(o: CostGapOrder, now: Date, ownNames: string[] = []): boolean {
  if (o.paymentStatus !== "PAID" || !o.paidAt || o.status === "CANCELLED") return false;
  if (now.getTime() - o.paidAt.getTime() < COST_GAP_AFTER_HOURS * HOUR) return false;
  if (o.supplierCostCents != null) return false;
  if (o.assignments.some((a) => (a.isWinning || a.status === "ACCEPTED") && a.quotedPriceCents != null)) return false;
  // Solo en la alarma (lado seguro, sin ruido): «Juan» a secas en un par con francés es Juan Silva.
  const own = !o.assignedTo?.trim() || isOwnTranslator(o.assignedTo, ownNames) || normName(o.assignedTo) === "juan";
  return !(isFrLangPair(o.langPair) && own);
}

/** Gasto de colaborador (devengo o factura recibida) tal como lo lee el vigía. */
export type ColabExpense = { orderReference: string | null; isAccrual: boolean; concept: string; supplier: string | null; baseCents: number; date: Date };

/**
 * El coste de un pedido vive en el libro de gastos, no en Order.supplierCostCents:
 * devengo/factura con orderReference, o factura del mes cuyo concepto lista la ref
 * («Factura X · 3 encargo(s): 26_AAA, 26_BBB»). La factura manda sobre el devengo.
 */
export function linkedExpenseFor(reference: string, expenses: ColabExpense[]): ColabExpense | null {
  const mine = expenses.filter((e) => e.orderReference === reference || (!e.orderReference && !e.isAccrual && e.concept.includes(reference)));
  return mine.find((e) => !e.isAccrual) || mine[0] || null;
}

const isFrLangPair =(langPair: string | null | undefined) => norm(langPair).split(/->|>|-|_|\s+/).includes("fr");

/** Ficha de Collaborator del francés propio: identifica a Juan por email; el nombre es respaldo. */
export const OWN_TRANSLATOR_EMAIL = CASA_LANGS.fr.collaboratorEmail;


/**
 * Juan Silva (FR propio): su coste legítimo es null. ownNames = fullName de su ficha en BD
 * (por OWN_TRANSLATOR_EMAIL); sin ella, respaldo por nombre. «Juan Amor» nunca lo es.
 */
export function isOwnTranslator(name: string | null | undefined, ownNames: string[] = []): boolean {
  const n = normName(name);
  if (!n) return false;
  if ([...ownNames, CASA_LANGS.fr.nombre].some((o) => normName(o) === n)) return true;
  return n === "juan silva" || n.startsWith("juan silva ");
}

/** «45,50» / 45.5 → 4550 céntimos; vacío o no válido → null. */
export function parseEurToCents(v: unknown): number | null {
  if (v == null || (typeof v === "string" && !v.trim())) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(/\s|€/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/**
 * ¿Asignar este traductor exige coste? Sí si hay traductor, no es el francés propio y no hay
 * cifra (supplierCostCents, aunque sea 0, o asignación ganadora con precio).
 */
export function needsSupplierCost(i: {
  translator: string | null | undefined;
  langPair: string | null | undefined;
  supplierCostCents: number | null | undefined;
  winningPriceCents?: number | null;
  /** Traductor que tenía el pedido: si cambia, su coste no vale para el nuevo. */
  previousTranslator?: string | null;
  ownNames?: string[];
}): boolean {
  if (!String(i.translator || "").trim()) return false;
  if (isFrLangPair(i.langPair) && isOwnTranslator(i.translator, i.ownNames)) return false;
  if (i.winningPriceCents != null) return false;
  const prev = String(i.previousTranslator || "").trim();
  const costIsHis = !prev || sameTranslatorExact(prev, i.translator);
  return !(i.supplierCostCents != null && costIsHis);
}
