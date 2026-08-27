// lib/learned-rates.ts — TARIFARIO APRENDIDO (agente de precios, Juan 27-ago-2026).
//
// «Cada vez que se repita un documento y tengamos precio de traductor y de pago,
// mantenerlo e incorporarlo al bucle. No molestar al traductor con el mismo
// documento y actuar automáticamente.»
//
// Tres entradas al bucle:
//   1. precio_propuesto de lavori (lead o pedido)  → coste del jurado por unidad
//   2. presupuesto pagado                           → precio neto del cliente por unidad
//   3. semillas / edición a mano en /zona-traductor/tarifario
// Una salida: la puerta, al pedir presupuesto, si TODOS los documentos tienen
// tarifa APPROVED, emite y envía el presupuesto sola (autoQuoteFromPuertaSession)
// y no manda solicitud a lavori; al pagar, el jurado de la tarifa recibe el
// encargo con su cifra ya cerrada (workflow-server → paraTiCents).
//
// Nunca francés (motor de reglas de Juan) ni pares sin español.

import { prisma } from "@/lib/prisma";
import { computeQuoteTotals, calculateValidUntil, generateQuoteNumber, generateQuoteToken, decimalToNumber } from "@/lib/quotes";
import { QUOTE_PDF_LANGS } from "@/lib/quote-pdf-langs";

export const LEARNED_MARGIN_PCT = 12; // margen sobre coste del jurado (horquilla Juan 10-15 %)
export const DOC_FLOOR_CENTS = 4000; // 40 € netos mínimo por documento (regla Juan 26-ago)
export const WORD_UNIT_MIN_WORDS = 600; // desde aquí la tarifa se aprende por 1000 palabras
export const SIZE_TOLERANCE = 0.3; // ±30 % de tamaño para reutilizar una tarifa por documento
export const AUTO_QUOTE_MAX_CENTS = 60000; // por encima de 600 € netos, siempre humano

export type RateDirection = "to_es" | "from_es";
export type RateKey = { lang: string; direction: RateDirection; docType: string; apostille: boolean };
export type DocInfo = RateKey & {
  analysisId: string;
  fileName: string;
  fileUrl: string;
  words: number | null;
  pages: number | null;
};

type AnalysisRow = {
  id: string;
  fileName: string;
  fileUrl: string;
  documentType: string | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  estimatedWords: number | null;
  pageCount: number | null;
  quoteBreakdown: unknown;
  analysisJson: unknown;
};

const ANALYSIS_SELECT = {
  id: true,
  fileName: true,
  fileUrl: true,
  documentType: true,
  sourceLanguage: true,
  targetLanguage: true,
  estimatedWords: true,
  pageCount: true,
  quoteBreakdown: true,
  analysisJson: true,
} as const;

export function isLearnedRatesLive() {
  return String(process.env.LEARNED_RATES_LIVE || "").toLowerCase() !== "off";
}

export function normalizeDocType(raw: string | null | undefined) {
  const t = String(raw || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  return t || "other";
}

/** Clave de tarifa de un análisis de la puerta. null = no aprendible (fr, sin par, sin español). */
export function docInfoFromAnalysis(row: AnalysisRow): DocInfo | null {
  const known = (l: string | null | undefined) => {
    const v = String(l || "").trim().toLowerCase();
    return v && v !== "unknown" ? v : null;
  };
  const source = known(row.sourceLanguage);
  const target = known(row.targetLanguage) || "es";
  if (!source) return null;
  if (source !== "es" && target !== "es") return null;
  const lang = source === "es" ? target : source;
  if (lang === "es" || lang === "fr") return null;
  const direction: RateDirection = source === "es" ? "from_es" : "to_es";
  const docType = normalizeDocType(row.documentType);
  const breakdown = (row.quoteBreakdown || {}) as { apostilleSurcharge?: number };
  const aj = (row.analysisJson || {}) as { document_type?: { has_apostille?: boolean } };
  const apostille =
    docType === "apostille" ||
    Number(breakdown.apostilleSurcharge || 0) > 0 ||
    aj.document_type?.has_apostille === true ||
    /apostil/i.test(row.fileName || "");
  return {
    lang,
    direction,
    docType,
    apostille,
    analysisId: row.id,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    words: row.estimatedWords ?? null,
    pages: row.pageCount ?? null,
  };
}

export function unitFor(words: number | null | undefined): "doc" | "kword" {
  return words && words >= WORD_UNIT_MIN_WORDS ? "kword" : "doc";
}

export function rateKeyLabel(k: { lang: string; direction: string; docType: string; apostille: boolean; unit?: string }) {
  const par = k.direction === "to_es" ? `${k.lang.toUpperCase()}>ES` : `ES>${k.lang.toUpperCase()}`;
  return `${par} · ${k.docType}${k.apostille ? " +apostilla" : ""}${k.unit ? ` · por ${k.unit === "doc" ? "documento" : "1000 palabras"}` : ""}`;
}

function sameKey(docs: DocInfo[]): RateKey | null {
  if (docs.length === 0) return null;
  const k = docs[0];
  const all = docs.every((d) => d.lang === k.lang && d.direction === k.direction && d.docType === k.docType && d.apostille === k.apostille);
  return all ? { lang: k.lang, direction: k.direction, docType: k.docType, apostille: k.apostille } : null;
}

/** Sube una muestra a la tarifa de su clave (la crea como CANDIDATE si no existe).
 * costCents/clientCents son POR UNIDAD (doc o 1000 palabras). El coste y el precio
 * guardados en la tarifa son los ÚLTIMOS confirmados (no medias): es lo que el
 * jurado cobra hoy. wordsRef sí es media, para la tolerancia de tamaño. */
export async function recordSample(
  key: RateKey,
  sample: {
    unit: "doc" | "kword";
    kind: "translator_price" | "client_paid" | "seed" | "manual" | "auto_quote";
    costCents?: number | null;
    clientCents?: number | null;
    words?: number | null;
    pages?: number | null;
    plazoDias?: number | null;
    miembroId?: string | null;
    miembroNombre?: string | null;
    quoteId?: string | null;
    leadRef?: string | null;
    orderRef?: string | null;
    note?: string | null;
  }
) {
  const where = { lang_direction_docType_apostille: key };
  const existing = await prisma.learnedRate.findUnique({ where });
  const cost = sample.costCents != null && sample.costCents > 0 ? Math.round(sample.costCents) : null;
  const client = sample.clientCents != null && sample.clientCents > 0 ? Math.round(sample.clientCents) : null;
  const countsAsSample = sample.kind !== "auto_quote";
  let rate;
  if (!existing) {
    if (cost == null && client == null) return null;
    rate = await prisma.learnedRate.create({
      data: {
        ...key,
        unit: sample.unit,
        costCents: cost ?? Math.round((client as number) / (1 + LEARNED_MARGIN_PCT / 100)),
        clientCents: client,
        wordsRef: sample.words ?? null,
        plazoDias: sample.plazoDias ?? null,
        miembroId: sample.miembroId ?? null,
        miembroNombre: sample.miembroNombre ?? null,
        status: "CANDIDATE",
        samples: countsAsSample ? 1 : 0,
        lastSampleAt: new Date(),
        note: sample.note ?? null,
      },
    });
  } else {
    const n = existing.samples;
    const wordsRef =
      sample.words && countsAsSample
        ? existing.wordsRef
          ? Math.round((existing.wordsRef * n + sample.words) / (n + 1))
          : sample.words
        : existing.wordsRef;
    rate = await prisma.learnedRate.update({
      where: { id: existing.id },
      data: {
        ...(cost != null && sample.kind !== "auto_quote" ? { costCents: cost } : {}),
        ...(client != null && sample.kind !== "auto_quote" ? { clientCents: client } : {}),
        ...(sample.unit && sample.kind === "translator_price" ? { unit: sample.unit } : {}),
        wordsRef,
        ...(sample.plazoDias ? { plazoDias: sample.plazoDias } : {}),
        ...(sample.miembroId ? { miembroId: sample.miembroId, miembroNombre: sample.miembroNombre ?? existing.miembroNombre } : {}),
        ...(countsAsSample ? { samples: n + 1, lastSampleAt: new Date() } : {}),
      },
    });
  }
  await prisma.learnedRateSample.create({
    data: {
      rateId: rate.id,
      kind: sample.kind,
      costCents: cost,
      clientCents: client,
      words: sample.words ?? null,
      pages: sample.pages ?? null,
      quoteId: sample.quoteId ?? null,
      leadRef: sample.leadRef ?? null,
      orderRef: sample.orderRef ?? null,
      miembroId: sample.miembroId ?? null,
      note: sample.note ?? null,
    },
  });
  return rate;
}

/** Documentos de una solicitud lavori: puerta:<token> → sessionToken; EXP-X → exp:EXP-X. */
async function analysesForExpedienteRef(expedienteRef: string | null | undefined) {
  const ref = String(expedienteRef || "").trim();
  if (!ref) return [];
  const sessionToken = ref.startsWith("puerta:") ? ref.slice("puerta:".length) : ref.startsWith("exp:") ? ref : `exp:${ref}`;
  return prisma.documentAnalysis.findMany({ where: { sessionToken, fileUrl: { not: "" } }, orderBy: { createdAt: "asc" }, take: 20, select: ANALYSIS_SELECT });
}

/** Reparte un precio total del jurado entre N documentos de la MISMA clave y lo
 * registra como coste por unidad. Claves mezcladas → no se aprende (ambiguo). */
async function learnCostFromDocs(opts: {
  rows: AnalysisRow[];
  priceCents: number;
  plazoDias?: number | null;
  miembroId?: string | null;
  miembroNombre?: string | null;
  leadRef?: string | null;
  orderRef?: string | null;
  quoteId?: string | null;
}): Promise<{ learned: boolean; reason?: string; rateId?: string }> {
  const infos = opts.rows.map(docInfoFromAnalysis).filter(Boolean) as DocInfo[];
  if (infos.length === 0) return { learned: false, reason: "sin documentos aprendibles" };
  const key = sameKey(infos);
  if (!key) return { learned: false, reason: `documentos de tipos distintos (${Array.from(new Set(infos.map((i) => i.docType))).join(", ")})` };
  const totalWords = infos.reduce((a, d) => a + (d.words || 0), 0);
  const avgWords = infos.length ? Math.round(totalWords / infos.length) : null;
  const unit = unitFor(avgWords);
  const costPerUnit = unit === "doc" ? opts.priceCents / infos.length : totalWords > 0 ? (opts.priceCents / totalWords) * 1000 : null;
  if (!costPerUnit) return { learned: false, reason: "sin palabras para tarifa por palabra" };
  const rate = await recordSample(key, {
    unit,
    kind: "translator_price",
    costCents: costPerUnit,
    words: avgWords,
    pages: infos[0].pages,
    plazoDias: opts.plazoDias ?? null,
    miembroId: opts.miembroId ?? null,
    miembroNombre: opts.miembroNombre ?? null,
    leadRef: opts.leadRef ?? null,
    orderRef: opts.orderRef ?? null,
    quoteId: opts.quoteId ?? null,
    note: `${infos.length} doc · ${(opts.priceCents / 100).toFixed(2)} € total`,
  });
  return rate ? { learned: true, rateId: rate.id } : { learned: false, reason: "sin importe" };
}

/** Entrada 1a: precio_propuesto sobre una SOLICITUD (lead). */
export async function learnFromLeadPrice(leadId: string) {
  const lead = await prisma.lavoriPriceRequest.findUnique({
    where: { id: leadId },
    select: { ref: true, expedienteRef: true, priceCents: true, plazoDias: true, miembroId: true, miembroNombre: true, quoteId: true },
  });
  if (!lead?.priceCents) return { learned: false, reason: "lead sin precio" };
  let rows = await analysesForExpedienteRef(lead.expedienteRef);
  // Lead sin expediente (WhatsApp): los documentos llegan por las líneas del
  // presupuesto que se ató después.
  if (rows.length === 0 && lead.quoteId) {
    const lines = await prisma.quoteLine.findMany({ where: { quoteId: lead.quoteId, sourceFileUrl: { not: null } }, select: { sourceFileUrl: true } });
    const urls = lines.map((l) => l.sourceFileUrl!).filter(Boolean);
    if (urls.length) rows = await prisma.documentAnalysis.findMany({ where: { fileUrl: { in: urls } }, select: ANALYSIS_SELECT });
  }
  if (rows.length === 0) return { learned: false, reason: "lead sin documentos analizados" };
  return learnCostFromDocs({
    rows,
    priceCents: lead.priceCents,
    plazoDias: lead.plazoDias,
    miembroId: lead.miembroId,
    miembroNombre: lead.miembroNombre,
    leadRef: lead.ref,
    quoteId: lead.quoteId,
  });
}

/** Entrada 1b: precio_propuesto sobre un PEDIDO directo (documentos de la puerta con orderReference). */
export async function learnFromOrderPrice(opts: { orderId: string; reference: string; priceCents: number; plazoDias?: number | null; miembroId?: string | null; miembroNombre?: string | null }) {
  const rows = await prisma.documentAnalysis.findMany({
    where: { OR: [{ orderId: opts.orderId }, { orderReference: opts.reference }], fileUrl: { not: "" } },
    take: 20,
    select: ANALYSIS_SELECT,
  });
  if (rows.length === 0) return { learned: false, reason: "pedido sin análisis de la puerta" };
  return learnCostFromDocs({ rows, priceCents: opts.priceCents, plazoDias: opts.plazoDias, miembroId: opts.miembroId, miembroNombre: opts.miembroNombre, orderRef: opts.reference });
}

/** Entrada 2: presupuesto PAGADO → precio neto del cliente por unidad (y coste si la línea lo trae). */
export async function learnFromPaidQuote(quoteId: string) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      quoteNumber: true,
      lavoriMiembroId: true,
      lavoriMiembroNombre: true,
      lines: { select: { description: true, unitPrice: true, supplierUnitCost: true, sourceFileUrl: true } },
    },
  });
  if (!quote) return { learned: 0 };
  const lead = await prisma.lavoriPriceRequest.findFirst({
    where: { quoteId: quote.id, priceCents: { not: null } },
    orderBy: { updatedAt: "desc" },
    select: { priceCents: true, plazoDias: true, miembroId: true, miembroNombre: true, docsCount: true },
  });
  const urls = quote.lines.map((l) => l.sourceFileUrl).filter(Boolean) as string[];
  if (urls.length === 0) return { learned: 0 };
  const rows = await prisma.documentAnalysis.findMany({ where: { fileUrl: { in: urls } }, select: ANALYSIS_SELECT });
  const byUrl = new Map(rows.map((r) => [r.fileUrl, r]));
  const infos = quote.lines.map((l) => (l.sourceFileUrl ? docInfoFromAnalysis(byUrl.get(l.sourceFileUrl)!) : null));
  const single = sameKey(infos.filter(Boolean) as DocInfo[]);
  // Coste del jurado: la cifra de lavori repartida (si todas las líneas son de la
  // misma clave); si no, el coste que Juan puso en la línea.
  const leadCostPerDoc = lead?.priceCents && single && infos.every(Boolean) ? lead.priceCents / quote.lines.length : null;
  let learned = 0;
  for (let i = 0; i < quote.lines.length; i++) {
    const info = infos[i];
    const line = quote.lines[i];
    if (!info) continue;
    const unit = unitFor(info.words);
    const priceCents = Math.round(decimalToNumber(line.unitPrice) * 100);
    const lineCost = line.supplierUnitCost != null ? Math.round(decimalToNumber(line.supplierUnitCost) * 100) : null;
    const costDoc = leadCostPerDoc ?? lineCost;
    const perUnit = (cents: number | null) => (cents == null ? null : unit === "doc" ? cents : info.words ? (cents / info.words) * 1000 : null);
    await recordSample(
      { lang: info.lang, direction: info.direction, docType: info.docType, apostille: info.apostille },
      {
        unit,
        kind: "client_paid",
        clientCents: perUnit(priceCents),
        costCents: perUnit(costDoc),
        words: info.words,
        pages: info.pages,
        plazoDias: lead?.plazoDias ?? null,
        miembroId: lead?.miembroId ?? quote.lavoriMiembroId ?? null,
        miembroNombre: lead?.miembroNombre ?? quote.lavoriMiembroNombre ?? null,
        quoteId: quote.id,
        note: `${quote.quoteNumber} · ${line.description.slice(0, 80)}`,
      }
    );
    learned++;
  }
  return { learned };
}

/** Tarifa APPROVED aplicable a un documento: clave exacta, o comodín "any" por
 * palabra para documentos largos. Con unit=doc exige tamaño parecido (±30 %). */
export async function findApprovedRate(info: DocInfo) {
  if (!isLearnedRatesLive()) return null;
  const exact = await prisma.learnedRate.findUnique({
    where: { lang_direction_docType_apostille: { lang: info.lang, direction: info.direction, docType: info.docType, apostille: info.apostille } },
  });
  if (exact?.status === "APPROVED") {
    if (exact.unit === "doc" && exact.wordsRef && info.words) {
      const diff = Math.abs(info.words - exact.wordsRef) / exact.wordsRef;
      if (diff > SIZE_TOLERANCE) return null;
    }
    if (exact.unit === "kword" && !info.words) return null;
    return exact;
  }
  if (info.words && info.words >= WORD_UNIT_MIN_WORDS) {
    const any = await prisma.learnedRate.findUnique({
      where: { lang_direction_docType_apostille: { lang: info.lang, direction: info.direction, docType: "any", apostille: false } },
    });
    if (any?.status === "APPROVED" && any.unit === "kword") return any;
  }
  return null;
}

function roundUp50(cents: number) {
  return Math.ceil(cents / 50) * 50;
}

/** Precio neto al cliente y coste del jurado para un documento con su tarifa. */
export function priceDocWithRate(rate: { unit: string; costCents: number; clientCents: number | null }, words: number | null) {
  const perUnitClient = rate.clientCents ?? Math.round(rate.costCents * (1 + LEARNED_MARGIN_PCT / 100));
  if (rate.unit === "kword") {
    const w = Math.max(1, words || 0);
    const client = Math.max(DOC_FLOOR_CENTS, roundUp50((w * perUnitClient) / 1000));
    const cost = Math.round((w * rate.costCents) / 1000);
    return { clientCents: client, costCents: cost };
  }
  return { clientCents: Math.max(DOC_FLOOR_CENTS, roundUp50(perUnitClient)), costCents: rate.costCents };
}

export type AutoQuoteResult =
  | { ok: true; quoteId: string; quoteNumber: string; totalEur: number; payUrl: string; miembroNombre: string | null; lines: number; emailSent: boolean; smsSent: boolean }
  | { ok: false; reason: string };

/** SALIDA del bucle: la puerta pide presupuesto → si todos los documentos tienen
 * tarifa aprobada, se emite y envía el presupuesto sin pasar por lavori. */
export async function autoQuoteFromPuertaSession(opts: {
  sessionToken: string;
  contactEmail: string;
  contactPhone: string;
  contactName?: string | null;
  locale?: string | null;
}): Promise<AutoQuoteResult> {
  if (!isLearnedRatesLive()) return { ok: false, reason: "LEARNED_RATES_LIVE=off" };
  const rows = await prisma.documentAnalysis.findMany({
    where: { sessionToken: opts.sessionToken, fileUrl: { not: "" } },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { ...ANALYSIS_SELECT, clientName: true, clientEmail: true, clientPhone: true },
  });
  if (rows.length === 0) return { ok: false, reason: "sesión sin documentos" };
  // El mismo archivo subido dos veces (caso Gregory 27-ago) cuenta una vez.
  const seen = new Set<string>();
  const uniqueRows = rows.filter((r) => {
    const k = `${r.fileName}|${r.estimatedWords}|${r.pageCount}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const infos: DocInfo[] = [];
  for (const r of uniqueRows) {
    const info = docInfoFromAnalysis(r);
    if (!info) return { ok: false, reason: `documento no aprendible (${r.fileName})` };
    infos.push(info);
  }
  const priced: { info: DocInfo; rate: NonNullable<Awaited<ReturnType<typeof findApprovedRate>>>; clientCents: number; costCents: number }[] = [];
  for (const info of infos) {
    const rate = await findApprovedRate(info);
    if (!rate) return { ok: false, reason: `sin tarifa aprobada para ${rateKeyLabel(info)}${info.words ? ` (${info.words} pal.)` : ""}` };
    const p = priceDocWithRate(rate, info.words);
    priced.push({ info, rate, ...p });
  }
  const miembros = Array.from(new Set(priced.map((p) => p.rate.miembroId).filter(Boolean))) as string[];
  if (miembros.length > 1) return { ok: false, reason: "tarifas de jurados distintos en el mismo expediente" };
  const subtotalCents = priced.reduce((a, p) => a + p.clientCents, 0);
  if (subtotalCents > AUTO_QUOTE_MAX_CENTS) return { ok: false, reason: `importe ${(subtotalCents / 100).toFixed(2)} € por encima del tope automático` };

  const email = (opts.contactEmail || rows.find((r) => r.clientEmail)?.clientEmail || "").trim().toLowerCase();
  const phone = (opts.contactPhone || rows.find((r) => r.clientPhone)?.clientPhone || "").trim();
  const customerEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : phone ? `${phone.replace(/\D/g, "") || "sintelefono"}@whatsapp.local` : "";
  if (!customerEmail) return { ok: false, reason: "sin email ni teléfono" };
  const customerName = (opts.contactName || rows.find((r) => r.clientName)?.clientName || email.split("@")[0] || "Cliente").trim().slice(0, 120);
  const sourceLang = infos[0].direction === "to_es" ? infos[0].lang : "es";
  const targetLang = infos[0].direction === "to_es" ? "es" : infos[0].lang;
  const plazo = Math.max(0, ...priced.map((p) => p.rate.plazoDias || 0));
  const deliveryTerm = plazo > 0 ? `${plazo}-${plazo + 1} días hábiles` : "3-4 días hábiles";
  const miembroNombre = priced.find((p) => p.rate.miembroNombre)?.rate.miembroNombre ?? null;
  const pdfLang = (QUOTE_PDF_LANGS as readonly string[]).includes(String(opts.locale || "")) ? String(opts.locale) : "es";

  const { getLanguageName } = await import("@/lib/pricing-engine/languages");
  const { docTypeLabelEs } = await import("@/lib/lavori-lead");
  const lines = priced.map((p) => {
    const row = uniqueRows.find((r) => r.id === p.info.analysisId)!;
    const label = docTypeLabelEs(row.documentType, row.analysisJson) || p.info.docType.replace(/_/g, " ");
    const desc = `${label.charAt(0).toUpperCase()}${label.slice(1)} (${getLanguageName(sourceLang)}→${getLanguageName(targetLang)}${p.info.words ? `, ${p.info.words} palabras` : ""}${p.info.pages ? `, ${p.info.pages} pág${p.info.pages === 1 ? "" : "s"}` : ""})`;
    return { description: desc, quantity: 1, unitPrice: p.clientCents / 100, supplierUnitCost: p.costCents / 100, sourceFileUrl: p.info.fileUrl };
  });
  const totals = computeQuoteTotals({ lines, discountType: "NONE", discountValue: 0, vatRate: 0.21, deliveryType: "DIGITAL_PDF", shippingBase: 0 });
  const issuedAt = new Date();
  const validUntil = calculateValidUntil(issuedAt, 15);

  const year = issuedAt.getFullYear();
  const baseCount = await prisma.quote.count({ where: { quoteNumber: { startsWith: `${year}-` } } });
  let quoteNumber = "";
  for (let attempt = 0; attempt < 8 && !quoteNumber; attempt++) {
    const candidate = await generateQuoteNumber(baseCount + attempt + 1, issuedAt);
    if (!(await prisma.quote.findUnique({ where: { quoteNumber: candidate }, select: { id: true } }))) quoteNumber = candidate;
  }
  if (!quoteNumber) return { ok: false, reason: "no se pudo numerar el presupuesto" };
  let publicToken = "";
  for (let attempt = 0; attempt < 10 && !publicToken; attempt++) {
    const t = generateQuoteToken(28);
    if (!(await prisma.quote.findUnique({ where: { publicToken: t }, select: { id: true } }))) publicToken = t;
  }

  const created = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { email: customerEmail },
      update: { name: customerName, phone: phone || undefined },
      create: { name: customerName, email: customerEmail, phone: phone || null },
    });
    return tx.quote.create({
      data: {
        quoteNumber,
        status: "DRAFT",
        customerId: customer.id,
        customerName,
        customerEmail,
        customerPhone: phone || null,
        sourceLang,
        targetLang,
        deliveryType: "DIGITAL_PDF",
        deliveryTerm,
        shippingBase: 0,
        vatRate: totals.vatRate,
        discountType: "NONE",
        discountValue: 0,
        validityDays: 15,
        issuedAt,
        validUntil,
        publicToken,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        shippingAmount: totals.shippingAmount,
        vatAmount: totals.vatAmount,
        total: totals.total,
        adminCreatedBy: "system:tarifario",
        expedienteRef: `puerta:${opts.sessionToken}`,
        marginPct: LEARNED_MARGIN_PCT,
        paymentMethods: ["sabadell", "bizum607"],
        pdfLang,
        autoPricedBy: "tarifario",
        lavoriMiembroId: miembros[0] ?? null,
        lavoriMiembroNombre: miembroNombre,
        lines: {
          create: totals.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            supplierUnitCost: line.supplierUnitCost,
            lineTotal: line.lineTotal,
            sourceFileUrl: line.sourceFileUrl,
          })),
        },
      },
      select: { id: true, quoteNumber: true, total: true },
    });
  });

  const { finalizeAndSendQuote } = await import("@/lib/quote-send");
  const sent = await finalizeAndSendQuote({ quoteId: created.id, actorEmail: "system:tarifario" });

  // Cliente solo-WhatsApp: el enlace de pago va por SMS (el email-marcador no llega).
  let smsSent = false;
  if (customerEmail.endsWith("@whatsapp.local") && phone) {
    try {
      const { sendNotification, formatPhoneSpain } = await import("@/lib/sms");
      const res = await sendNotification({
        to: formatPhoneSpain(phone),
        body: `traduccionesjuradas.net: tu presupuesto ${quoteNumber} (${decimalToNumber(created.total).toFixed(2)} € IVA incl., entrega ${deliveryTerm}) y el pago: ${sent.payUrl}`,
      });
      smsSent = !!res.ok;
    } catch (err) {
      console.error("[tarifario] SMS presupuesto fallo:", err);
    }
  }

  for (const p of priced) {
    await recordSample(
      { lang: p.info.lang, direction: p.info.direction, docType: p.rate.docType, apostille: p.rate.apostille },
      { unit: p.rate.unit as "doc" | "kword", kind: "auto_quote", clientCents: p.clientCents, costCents: p.costCents, words: p.info.words, pages: p.info.pages, quoteId: created.id, note: `auto ${quoteNumber}` }
    ).catch(() => null);
  }

  return {
    ok: true,
    quoteId: created.id,
    quoteNumber,
    totalEur: decimalToNumber(created.total),
    payUrl: sent.payUrl,
    miembroNombre,
    lines: lines.length,
    emailSent: sent.emailSent,
    smsSent,
  };
}
