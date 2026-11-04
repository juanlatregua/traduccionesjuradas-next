// lib/agente-bandeja-math.ts — Decisiones PURAS del agente de bandeja (emails nuevos
// de hola@ → presupuesto por el mismo hilo). Sin imports de servidor: se testea con
// node --test. La capa de BD/Graph vive en lib/agente-bandeja.ts.

import type { DocumentAnalysisResult } from "./ai/analyze-document.ts";
import { suggestClientLang } from "./client-lang.ts";
import { billablePages, computePagePricing, FR_DOC_MAX_PAGES } from "./pricing-engine/page-pricing.ts";

export type AgenteBandejaMode = "off" | "draft" | "on";
export type ReplyLang = "es" | "fr" | "en";

export const CANDIDATE_WINDOW_HOURS = 48;
export const MAX_EMAILS_PER_RUN = 5;
export const MAX_DOCS = 4;
export const MIN_TYPE_CONFIDENCE = 0.6;
export const FR_DELIVERY_TERM = "1 día hábil desde el pago";
export const FR_TRANSLATOR = { name: "Juan Silva Moreno", maec: "3850" };
/** Marca del borrador mientras el agente trabaja: si la ejecución muere, Juan lo ve en la bandeja. */
export const CLAIM_SUBJECT = "[agente bandeja] procesando";
/** Marca de una fila que el agente dejó a medias (ya avisada) o en la que falló: no se reintenta. */
export const STALE_SUBJECT = "[agente bandeja] interrumpido: revisar a mano";
export const ERROR_SUBJECT = "[agente bandeja] error: revisar a mano";
export const STALE_CLAIM_MINUTES = 10;
/** Margen mínimo para empezar un email (lectura con IA) y para enviar. */
export const START_MIN_REMAINING_MS = 150_000;
export const SEND_MIN_REMAINING_MS = 60_000;

export function agenteBandejaMode(raw: string | null | undefined): AgenteBandejaMode {
  const v = String(raw || "").trim().toLowerCase();
  return v === "on" || v === "draft" ? v : "off";
}

/** Buzones de la casa (tj.net, lavori): nunca son un cliente nuevo. */
export function isHouseAddress(email: string | null | undefined): boolean {
  return /@(?:[a-z0-9-]+\.)*(traduccionesjuradas\.net|lavori\.es|mitraductorjurado\.es|holabonjour\.es)$/i.test(String(email || "").trim());
}

/** Correo masivo o automático (boletines, facturas de proveedores, avisos): no es un lead. */
export function looksAutomated(o: { fromEmail: string; subject?: string | null; body?: string | null }): boolean {
  const from = String(o.fromEmail || "").toLowerCase();
  if (/^(news(letter)?|marketing|billing|invoices?|facturacion|facturas?|bounce|alerts?|support|soporte|notificaciones|avisos|info@mail|hello@mail)[@.+-]/.test(from)) return true;
  const t = fold(`${o.subject || ""}\n${o.body || ""}`);
  return /\b(unsubscribe|darse de baja|darte de baja|cancelar (la )?suscripcion|se desinscrire|se desabonner|desabonnement|view (this email )?in (your )?browser)\b/.test(t);
}

/** Justificante de pago o factura de un proveedor (no un documento a traducir): se salta sin gastar IA. */
export function looksLikePaymentOrInvoice(o: { subject?: string | null; body?: string | null; proofJson?: unknown }): boolean {
  if ((o.proofJson as { read?: { esJustificante?: boolean } } | null)?.read?.esJustificante === true) return true;
  const subject = fold(String(o.subject || "")).replace(/^\s*((re|rv|fw|fwd|tr)\s*:\s*)+/, "");
  if (/^(factura|invoice|facture|recibo|receipt)\b.*\d/.test(subject)) return true;
  const t = fold(`${subject}\n${o.body || ""}`);
  return /\b(?:(justificante|comprobante) de (la )?(pago|transferencia|bizum)|te (envio|adjunto|mando) el (justificante|comprobante)|le (envio|adjunto) el (justificante|comprobante)|ya (he|hemos) (pagado|hecho la transferencia)|transferencia realizada|pago realizado|preuve de (paiement|virement)|justificatif de (paiement|virement)|avis de virement|proof of payment|payment receipt|payment confirmation)\b/.test(t);
}

export function replyLang(text: string | null | undefined): ReplyLang {
  const l = suggestClientLang({ text: text || "" })?.lang;
  return l === "fr" || l === "en" ? l : "es";
}

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const MONTHS =
  "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december";
const DEADLINE_PATTERNS: RegExp[] = [
  /\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/,
  new RegExp(`\\b\\d{1,2}(?:er|st|nd|rd|th)?\\s+(?:de\\s+)?(?:${MONTHS})\\b`),
  new RegExp(`\\b(?:${MONTHS})\\s+\\d{1,2}\\b`),
  /\b(urgente?s?|urgencia|cuanto antes|lo antes posible|manana|pasado manana|esta semana|semana que viene|proxima semana|fecha limite|antes del|para el (lunes|martes|miercoles|jueves|viernes|sabado|domingo)|cita)\b/,
  /\b(asap|as soon as possible|deadline|tomorrow|this week|next week|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|appointment)\b/,
  /\b(au plus vite|des que possible|demain|cette semaine|semaine prochaine|avant le|d'ici|date limite|rendez-vous)\b/,
];

/** ¿El cliente ya dijo para cuándo lo necesita? Heurística: fecha, urgencia o plazo explícito. */
export function mentionsDeadline(text: string | null | undefined): boolean {
  const t = fold(String(text || ""));
  return DEADLINE_PATTERNS.some((re) => re.test(t));
}

/** Nombre de pila para el saludo, o null si no parece un nombre. */
export function greetingName(fromName: string | null | undefined): string | null {
  const first = String(fromName || "").trim().split(/\s+/)[0] || "";
  if (!first || first.includes("@") || !/^[\p{L}][\p{L}'-]{1,30}$/u.test(first)) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/* ───────────── Documentos leídos ───────────── */

export type Segment = {
  fileName: string;
  specificType: string;
  labelEs: string;
  labelFr: string | null;
  category: string;
  sourceLang: string;
  targetLang: string;
  pages: number;
  words: number;
  hasTables: boolean;
  hasApostille: boolean;
  apostilleSeparatePage: boolean;
  confidence: number;
  legible: boolean;
  risky: boolean;
  riskReasons: string[];
  /** Nombres del titular leídos (para detectar el mismo documento repetido). */
  names?: string[];
};

export function segmentFromAnalysis(a: DocumentAnalysisResult, fileName: string): Segment {
  return {
    fileName,
    specificType: String(a.document_type?.specific_type || "").toLowerCase(),
    labelEs: String(a.document_type?.specific_type_es || "").trim(),
    labelFr: a.document_type?.specific_type_fr ? String(a.document_type.specific_type_fr).trim() : null,
    category: String(a.document_type?.category || ""),
    sourceLang: String(a.language?.source || "").toLowerCase(),
    targetLang: String(a.language?.target || "").toLowerCase(),
    pages: Number(a.document_metrics?.pages) || 0,
    words: Number(a.document_metrics?.estimated_words) || 0,
    hasTables: !!a.document_metrics?.has_tables,
    hasApostille: !!a.requirements?.has_apostille,
    apostilleSeparatePage: a.requirements?.apostille_separate_page === true,
    confidence: Number(a.document_type?.confidence) || 0,
    legible: a.document_metrics?.is_legible !== false,
    risky: a.price_risk?.risky === true || (a.price_risk?.reasons?.length ?? 0) > 0,
    riskReasons: (a.price_risk?.reasons as string[] | undefined) || [],
    names: (a.extracted_data?.names || []).map((n) => fold(String(n)).trim()).filter(Boolean),
  };
}

/** Par «xx>yy» con español en un lado; null si falta un idioma o es cruzado. */
export function segmentPair(s: { sourceLang: string; targetLang: string }): string | null {
  const known = (c: string) => !!c && c !== "unknown";
  const src = s.sourceLang;
  const tgt = s.targetLang;
  if (!known(src)) return null;
  if (src === "es") return known(tgt) && tgt !== "es" ? `es>${tgt}` : null;
  if (known(tgt) && tgt !== "es") return null;
  return `${src}>es`;
}

export type SegmentCheck = { ok: true; pair: string; lane: "fr" | "tarifario" } | { ok: false; reason: string };

export function checkSegments(segs: Segment[]): SegmentCheck {
  if (segs.length === 0) return { ok: false, reason: "no se pudo leer ningún documento" };
  if (segs.length > MAX_DOCS) return { ok: false, reason: `${segs.length} documentos (más de ${MAX_DOCS}): precio a mano` };
  const pairs = new Set<string>();
  for (const s of segs) {
    const pair = segmentPair(s);
    if (!pair) return { ok: false, reason: `idiomas sin determinar o sin español (${s.fileName}: ${s.sourceLang || "?"}>${s.targetLang || "?"})` };
    if (s.risky) return { ok: false, reason: `riesgo de conteo/precio (${s.riskReasons.join(", ") || "detectado"}) en ${s.fileName}` };
    if (!s.legible) return { ok: false, reason: `documento poco legible (${s.fileName})` };
    if (s.confidence < MIN_TYPE_CONFIDENCE) return { ok: false, reason: `tipo de documento dudoso (${s.fileName}, confianza ${s.confidence})` };
    pairs.add(pair);
  }
  if (pairs.size > 1) return { ok: false, reason: `pares de idiomas mezclados (${[...pairs].join(", ")})` };
  const pair = [...pairs][0];
  return { ok: true, pair, lane: pair === "fr>es" || pair === "es>fr" ? "fr" : "tarifario" };
}

/**
 * ¿El mismo documento puede venir repartido o repetido? Varias fotos de un papel (p1.jpg +
 * p2.jpg) se cobrarían como dos documentos, y dos segmentos del mismo tipo y titular (o
 * del mismo archivo con el mismo tipo) pueden ser uno solo. En la duda, a mano.
 */
export function splitOrRepeatedReason(files: { fileName: string; mimeType: string }[], segs: Segment[]): string | null {
  if (files.length > 1 && files.some((f) => f.mimeType.toLowerCase().startsWith("image/"))) {
    return `${files.length} archivos con alguna imagen: pueden ser páginas del mismo documento`;
  }
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i];
      const b = segs[j];
      if (a.specificType !== b.specificType) continue;
      const sameFile = a.fileName === b.fileName;
      const sameHolder = (a.names || []).some((n) => (b.names || []).includes(n));
      if (sameFile || sameHolder) return `dos documentos «${a.labelEs || a.specificType}» del mismo ${sameHolder ? "titular" : "archivo"}: puede ser uno repetido`;
    }
  }
  return null;
}

export type FrLine = { description: string; unitPrice: number; label: string; pages: number };
export type FrPricing = { ok: true; lines: FrLine[]; netEur: number } | { ok: false; reason: string };

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** FR→ES: precio por documento del motor de Juan. Solo hasta 2 páginas por documento (más = a mano). */
export function priceFrSegments(segs: Segment[]): FrPricing {
  const bankStatements = segs.filter((s) => s.specificType === "bank_statement").length;
  const lines: FrLine[] = [];
  for (const s of segs) {
    if (s.sourceLang !== "fr") return { ok: false, reason: `ES→FR (${s.fileName}): precio a mano` };
    const pages = billablePages(s.pages);
    if (pages > FR_DOC_MAX_PAGES) return { ok: false, reason: `${s.fileName}: ${pages} páginas, desde ${FR_DOC_MAX_PAGES + 1} el precio es a mano` };
    const p = computePagePricing({
      specificType: s.specificType,
      foreignLang: "fr",
      inbound: true,
      pages: s.pages,
      hasTables: s.hasTables,
      hasApostille: s.hasApostille,
      apostilleSeparatePage: s.apostilleSeparatePage,
      bankStatementsInQuote: bankStatements,
      words: s.words,
      category: s.category,
    });
    if (!p) return { ok: false, reason: `${s.fileName}: tipo «${s.labelEs || s.specificType}» sin tarifa por documento` };
    const label = cap(s.labelEs || s.specificType.replace(/_/g, " "));
    lines.push({
      label,
      pages: p.pages,
      unitPrice: p.priceEur,
      description: `${label} (francés→español, ${p.pages} pág${p.pages === 1 ? "" : "s"}.${p.apostille ? ", con apostilla" : ""})`,
    });
  }
  const netEur = Math.round(lines.reduce((a, l) => a + l.unitPrice * 100, 0)) / 100;
  return { ok: true, lines, netEur };
}

/* ───────────── Envío o borrador ───────────── */

export type SendDecisionLike = { action: "send" } | { action: "skip"; reason: string } | { action: "alert"; reasons: string[] };

export const TARIFARIO_AUTOSEND_OFF = "autoenvío del tarifario apagado";

/** «send» solo en modo on y con la decisión en verde; fuera de FR, además, LEARNED_RATES_AUTOSEND=on (doble llave). */
export function bandejaAction(
  mode: AgenteBandejaMode,
  decision: SendDecisionLike,
  lane: { fr: boolean; learnedAutosend: boolean } = { fr: true, learnedAutosend: false }
): { action: "send" } | { action: "draft"; reasons: string[] } {
  if (mode === "on" && decision.action === "send") return lane.fr || lane.learnedAutosend ? { action: "send" } : { action: "draft", reasons: [TARIFARIO_AUTOSEND_OFF] };
  if (decision.action === "alert") return { action: "draft", reasons: decision.reasons };
  if (decision.action === "skip") return { action: "draft", reasons: [decision.reason] };
  return { action: "draft", reasons: [mode === "draft" ? "modo borrador (AGENTE_BANDEJA=draft)" : "agente apagado"] };
}

/* ───────────── Textos ───────────── */

function eur(n: number, lang: ReplyLang): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return lang === "en" ? `€${v}` : `${v.replace(".", ",")} €`;
}

/** «3-4 días hábiles», «1 día hábil desde el pago» → idioma de la respuesta. */
export function localizeTerm(term: string, lang: ReplyLang): string {
  if (lang === "es") return term;
  const t = term.trim();
  if (lang === "fr") {
    return t
      .replace(/días hábiles/g, "jours ouvrables")
      .replace(/día hábil/g, "jour ouvrable")
      .replace(/desde el pago/g, "à compter du paiement");
  }
  return t
    .replace(/(\d+)\s*día hábil/g, (_m, n) => `${n} business day`)
    .replace(/días hábiles/g, "business days")
    .replace(/desde el pago/g, "from payment");
}

export function buildNoDocDraft(o: { lang: ReplyLang; name: string | null }): string {
  if (o.lang === "fr") {
    return `Bonjour${o.name ? ` ${o.name}` : ""},

Merci pour votre message. Pour vous donner un prix ferme, nous avons besoin de voir le document : pouvez-vous nous envoyer le PDF (ou une photo lisible de toutes les pages) en réponse à ce courriel ?

Indiquez-nous aussi pour quelle date vous en avez besoin.

Bien cordialement,`;
  }
  if (o.lang === "en") {
    return `Hello${o.name ? ` ${o.name}` : ""},

Thank you for your message. To give you a firm price we need to see the document: could you send us the PDF (or a legible photo of every page) by replying to this email?

Please also let us know the date you need it by.

Kind regards,`;
  }
  return `Hola${o.name ? ` ${o.name}` : ""}:

Gracias por escribirnos. Para darle un precio cerrado necesitamos ver el documento: ¿puede enviarnos el PDF (o una foto legible de todas las páginas) respondiendo a este correo?

Díganos también para qué fecha lo necesita.

Un saludo,`;
}

/** Acuse para Juan cuando no hay precio automático: lo revisa, pone precio y responde. */
export function buildHoldingDraft(o: { lang: ReplyLang; name: string | null; askDeadline: boolean }): string {
  if (o.lang === "fr") {
    return `Bonjour${o.name ? ` ${o.name}` : ""},

Merci pour votre message et pour le document. Nous l'examinons et vous envoyons le devis très rapidement.${o.askDeadline ? "\n\nPour quelle date en avez-vous besoin ?" : ""}

Bien cordialement,`;
  }
  if (o.lang === "en") {
    return `Hello${o.name ? ` ${o.name}` : ""},

Thank you for your message and the document. We are reviewing it and will send you the quote shortly.${o.askDeadline ? "\n\nBy what date do you need it?" : ""}

Kind regards,`;
  }
  return `Hola${o.name ? ` ${o.name}` : ""}:

Gracias por escribirnos y por el documento. Lo estamos revisando y le enviamos el presupuesto enseguida.${o.askDeadline ? "\n\n¿Para qué fecha lo necesita?" : ""}

Un saludo,`;
}

export type QuoteReplyInput = {
  lang: ReplyLang;
  name: string | null;
  /** pages null = la etiqueta ya lo dice (línea del presupuesto). */
  items: { label: string; labelFr?: string | null; pages: number | null }[];
  netEur: number;
  totalEur: number;
  deliveryTerm: string;
  isFr: boolean;
  payUrl: string;
  askDeadline: boolean;
  /** PDF no adjuntado (no se pudo bajar): se da el enlace en su lugar. */
  pdfLink?: string | null;
  /** Borrador de un presupuesto aún en DRAFT: nota interna arriba, sin enlace /q ni «le adjunto». */
  draftOf?: { quoteNumber: string } | null;
};

export function buildQuoteReply(o: QuoteReplyInput): string {
  const L = o.lang;
  const pagesTxt = (n: number) => (L === "en" ? `${n} page${n === 1 ? "" : "s"}` : `${n} ${L === "fr" ? "page" : "página"}${n === 1 ? "" : "s"}`);
  const items = o.items.map((i) => `- ${L === "fr" && i.labelFr ? i.labelFr : i.label}${i.pages ? ` (${pagesTxt(i.pages)})` : ""}`).join("\n");
  const draft = o.draftOf;
  const pay = draft ? `[ENLACE DE PAGO: sale al sellar el presupuesto ${draft.quoteNumber}]` : o.payUrl;
  const pdfLine = (attached: string, link: string) => (draft ? "" : `\n${o.pdfLink ? `${link}${o.pdfLink}` : attached}`);
  const note = draft
    ? `[NOTA INTERNA — bórrala antes de enviar. Antes de enviar: pulsa Enviar en el presupuesto ${draft.quoteNumber} (con email desactivado) o pídeme que lo selle; luego pega aquí el enlace de pago y adjunta el PDF.]\n\n`
    : "";
  const term = localizeTerm(o.deliveryTerm, L);
  const price = L === "fr"
    ? `${eur(o.netEur, L)} HT + TVA = ${eur(o.totalEur, L)}`
    : L === "en"
      ? `${eur(o.netEur, L)} + VAT = ${eur(o.totalEur, L)}`
      : `${eur(o.netEur, L)} + IVA = ${eur(o.totalEur, L)}`;
  const translator = o.isFr
    ? {
        es: `${FR_TRANSLATOR.name}, traductor-intérprete jurado nombrado por el MAEC (n.º ${FR_TRANSLATOR.maec}).`,
        fr: `${FR_TRANSLATOR.name}, traducteur-interprète assermenté nommé par le ministère espagnol des Affaires étrangères (MAEC, n° ${FR_TRANSLATOR.maec}).`,
        en: `${FR_TRANSLATOR.name}, sworn translator-interpreter appointed by the Spanish Ministry of Foreign Affairs (MAEC no. ${FR_TRANSLATOR.maec}).`,
      }[L]
    : {
        es: "un traductor jurado nombrado por el MAEC.",
        fr: "un traducteur assermenté nommé par le ministère espagnol des Affaires étrangères (MAEC).",
        en: "a sworn translator appointed by the Spanish Ministry of Foreign Affairs (MAEC).",
      }[L];
  const signature = o.isFr ? `${FR_TRANSLATOR.name} · traductor jurado n.º ${FR_TRANSLATOR.maec} · traduccionesjuradas.net` : "TraduccionesJuradas.net";

  if (L === "fr") {
    return `${note}Bonjour${o.name ? ` ${o.name}` : ""},

Merci pour votre message. Voici notre devis pour la traduction assermentée de :
${items}

Prix : ${price}
Délai : ${term}
Livraison : PDF avec signature électronique qualifiée.
Traducteur : ${translator}

Pour confirmer, il suffit de payer ici : ${pay}${pdfLine("Vous trouverez le devis en PDF en pièce jointe.", "Le devis en PDF : ")}${o.askDeadline ? "\n\nPour quelle date en avez-vous besoin ?" : ""}

Bien cordialement,
${signature}`;
  }
  if (L === "en") {
    return `${note}Hello${o.name ? ` ${o.name}` : ""},

Thank you for your message. Here is our quote for the sworn translation of:
${items}

Price: ${price}
Turnaround: ${term}
Delivery: PDF with a qualified electronic signature.
Translator: ${translator}

To go ahead, simply pay here: ${pay}${pdfLine("The quote is attached as a PDF.", "The quote as a PDF: ")}${o.askDeadline ? "\n\nBy what date do you need it?" : ""}

Kind regards,
${signature}`;
  }
  return `${note}Hola${o.name ? ` ${o.name}` : ""}:

Gracias por escribirnos. Le paso el presupuesto de la traducción jurada de:
${items}

Precio: ${price}
Plazo: ${term}
Entrega: PDF con firma electrónica cualificada.
Traductor: ${translator}

Para confirmarlo basta con pagar aquí: ${pay}${pdfLine("Le adjunto el presupuesto en PDF.", "El presupuesto en PDF: ")}${o.askDeadline ? "\n\n¿Para qué fecha lo necesita?" : ""}

Un saludo,
${signature}`;
}
