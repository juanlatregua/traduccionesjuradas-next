// lib/encargo-cerrado.ts — ENCARGO CERRADO (orden Juan 21-nov-2026). La puerta
// presupuesta con la regla de coste del jurado (lib/encargo-cerrado-math.ts) sin
// pedirle precio; al pagar, routePactadoToMiembro le manda el encargo listo con su
// coste y plazo. Interruptores: ENCARGO_CERRADO=pt,en,de · ENCARGO_CERRADO_AUTOSEND=on.
// SOLO SERVIDOR (Prisma).

import { prisma } from "@/lib/prisma";
import { assessAutoPriceRisk } from "@/lib/ai/price-risk";
import { ANALYSIS_SELECT, createAutoQuote, docInfoFromAnalysis, findApprovedRate } from "@/lib/learned-rates";
import { isBlindPriceLang, priceDocWithRate } from "@/lib/learned-rates-math";
import {
  ENCARGO_CERRADO_AUTO_PRICED_BY,
  ENCARGO_CERRADO_JURADOS,
  ENCARGO_CERRADO_MAX_DOCS,
  CLOSED_RETIRE_STATUSES,
  langsWithCollaborator,
  closedRetireWhere,
  closedCostFor,
  closedDeliveryTerm,
  closedQuoteLines,
  encargoCerradoLangs,
  evaluateClosedQuote,
  isEncargoCerradoAutosend,
  medianPlazoDias,
  type ClosedDoc,
} from "@/lib/encargo-cerrado-math";

export type EncargoCerradoResult =
  | {
      ok: true;
      repetido: boolean;
      quoteId: string;
      quoteNumber: string;
      totalEur: number;
      subtotalEur: number;
      costEur: number;
      sent: boolean;
      payUrl: string | null;
      miembroNombre: string;
      plazoDias: number;
      regla: string;
      autoSendReasons: string[];
    }
  | { ok: false; reason: string; enCurso?: boolean };

/** Lenguas de ENCARGO_CERRADO cuyo jurado tiene Collaborator; la que no, se loguea y sigue como hoy. */
export async function activeEncargoCerradoLangs(): Promise<Set<string>> {
  const pedidas = encargoCerradoLangs(process.env.ENCARGO_CERRADO);
  if (pedidas.size === 0) return pedidas;
  const { LAVORI_MEMBER_COLLABORATOR_EMAIL } = await import("@/lib/lavori-bridge");
  const { activas, sinAlta } = langsWithCollaborator(pedidas, LAVORI_MEMBER_COLLABORATOR_EMAIL);
  if (sinAlta.length) console.warn(`[encargo-cerrado] ${sinAlta.join(",")} en ENCARGO_CERRADO sin Collaborator del jurado: sigue como hoy`);
  return activas;
}

/** Mediana de plazoDias que dio el jurado en sus solicitudes de precio (solo lectura). */
export async function plazoDiasDeJurado(lang: string): Promise<number> {
  const j = ENCARGO_CERRADO_JURADOS[lang];
  const rows = await prisma.lavoriPriceRequest.findMany({
    where: { miembroId: j.miembroId, plazoDias: { gt: 0 } },
    orderBy: { updatedAt: "desc" },
    take: 60,
    select: { plazoDias: true },
  });
  return medianPlazoDias(rows.map((r) => r.plazoDias), j.plazoReservaDias);
}

export async function encargoCerradoFromPuertaSession(opts: {
  sessionToken: string;
  contactEmail: string;
  contactPhone: string;
  contactName?: string | null;
  locale?: string | null;
  casoId?: string | null;
}): Promise<EncargoCerradoResult> {
  const langs = await activeEncargoCerradoLangs();
  if (langs.size === 0) return { ok: false, reason: "ENCARGO_CERRADO apagado" };
  const expedienteRef = `puerta:${opts.sessionToken}`;

  const rows = await prisma.documentAnalysis.findMany({
    where: { sessionToken: opts.sessionToken, fileUrl: { not: "" } },
    orderBy: { createdAt: "asc" },
    take: ENCARGO_CERRADO_MAX_DOCS + 1,
    select: { ...ANALYSIS_SELECT, clientName: true, clientEmail: true, clientPhone: true },
  });
  if (rows.length === 0) return { ok: false, reason: "sesión sin documentos" };
  if (rows.length > ENCARGO_CERRADO_MAX_DOCS) return { ok: false, reason: `más de ${ENCARGO_CERRADO_MAX_DOCS} documentos` };
  const seen = new Set<string>();
  const uniqueRows = rows.filter((r) => {
    const k = `${r.fileName}|${r.estimatedWords}|${r.pageCount}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const infos = [];
  for (const r of uniqueRows) {
    const info = docInfoFromAnalysis(r);
    if (!info) return { ok: false, reason: `documento sin par con español (${r.fileName})` };
    if (!langs.has(info.lang)) return { ok: false, reason: `ENCARGO_CERRADO no incluye ${info.lang}` };
    // Mismo freno de riesgo de conteo que el tarifario: la regla PT es por palabra.
    const risk = (r.analysisJson as any)?.price_risk;
    const re = assessAutoPriceRisk({ analysis: r.analysisJson as any, fileName: r.fileName });
    if (risk?.risky || (Array.isArray(risk?.reasons) && risk.reasons.length > 0) || re.risky) {
      return { ok: false, reason: `riesgo de conteo/precio (${r.fileName})` };
    }
    infos.push(info);
  }
  if (new Set(infos.map((i) => `${i.lang}|${i.direction}`)).size > 1) return { ok: false, reason: "documentos de pares distintos" };
  const lang = infos[0].lang;
  const sourceLang = infos[0].direction === "to_es" ? lang : "es";
  const targetLang = infos[0].direction === "to_es" ? "es" : lang;

  const docs: ClosedDoc[] = infos.map((info, i) => {
    const aj = (uniqueRows[i].analysisJson || {}) as any;
    return {
      docType: info.docType,
      words: info.words,
      apostille: info.apostille,
      pages: info.pages,
      combined: aj.segmented === true || (Array.isArray(aj.documents) && aj.documents.length > 1),
      label: aj.document_type?.specific_type_es ?? null,
    };
  });
  const rule = closedCostFor(sourceLang, targetLang, docs);
  if (!rule.ok) return rule;

  // Candado del hilo caso+par (como la puerta FR): dos peticiones simultáneas no montan dos borradores.
  const par = `${sourceLang}>${targetLang}`.toUpperCase();
  const casoId = opts.casoId ?? null;
  const { reservarHilo, presupuestoVivoDelCaso } = await import("@/lib/caso/hilo-db");
  const reserva = casoId ? await reservarHilo(casoId, par, "system:encargo-cerrado") : null;
  if (reserva && !reserva.ok) return { ok: false, reason: reserva.error, enCurso: true };
  try {
    return await crearBorradorCerrado({ opts, rows, uniqueRows, infos, rule, sourceLang, targetLang, expedienteRef, casoId, par, presupuestoVivoDelCaso });
  } finally {
    if (reserva?.ok) await reserva.liberar();
  }
}

async function crearBorradorCerrado(ctx: {
  opts: Parameters<typeof encargoCerradoFromPuertaSession>[0];
  rows: { clientEmail: string | null; clientPhone: string | null; clientName: string | null }[];
  uniqueRows: { documentType: string | null; analysisJson: unknown }[];
  infos: NonNullable<ReturnType<typeof docInfoFromAnalysis>>[];
  rule: Extract<ReturnType<typeof closedCostFor>, { ok: true }>;
  sourceLang: string;
  targetLang: string;
  expedienteRef: string;
  casoId: string | null;
  par: string;
  presupuestoVivoDelCaso: (casoId: string | null | undefined, par: string | null | undefined) => Promise<{ id: string } | null>;
}): Promise<EncargoCerradoResult> {
  const { opts, rows, uniqueRows, infos, rule, sourceLang, targetLang, expedienteRef } = ctx;
  const lang = rule.lang;

  // Un presupuesto vivo de esta sesión o del caso+par: no se monta otro (el cliente repite la petición).
  const previo = await prisma.quote.findFirst({
    where: { expedienteRef, deletedAt: null, status: { in: ["DRAFT", "SENT", "OPENED", "ACCEPTED"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, quoteNumber: true, total: true, subtotal: true, autoPricedBy: true },
  });
  if (previo) {
    if (previo.autoPricedBy !== ENCARGO_CERRADO_AUTO_PRICED_BY) return { ok: false, reason: `ya hay presupuesto ${previo.quoteNumber} en esta sesión` };
    return { ok: true, repetido: true, quoteId: previo.id, quoteNumber: previo.quoteNumber, totalEur: Number(previo.total), subtotalEur: Number(previo.subtotal), costEur: 0, sent: false, payUrl: null, miembroNombre: rule.nombre, plazoDias: 0, regla: rule.regla, autoSendReasons: ["ya montado antes"] };
  }
  const vivoCaso = await ctx.presupuestoVivoDelCaso(ctx.casoId, ctx.par).catch(() => null);
  if (vivoCaso) return { ok: false, reason: `el caso ya tiene presupuesto vivo para ${ctx.par}` };

  // Tarifa APROBADA del documento: solo da el PRECIO AL CLIENTE (el coste es la regla). DE nunca.
  const tariffs = await Promise.all(
    infos.map(async (info) => {
      if (isBlindPriceLang(info.lang)) return null;
      const rate = await findApprovedRate(info).catch(() => null);
      return rate?.clientCents != null ? priceDocWithRate(rate, info.words).clientCents : null;
    })
  );
  const docLines = closedQuoteLines(rule.costs, tariffs);
  const verdict = evaluateClosedQuote(docLines);
  if (!verdict.ok) return verdict;

  const { isLavoriMemberAvailable } = await import("@/lib/lavori-bridge");
  const disp = await isLavoriMemberAvailable(lang, rule.miembroId);
  if (!disp.ok) return { ok: false, reason: `${rule.nombre} no puede recibir el encargo ahora: ${disp.reason}` };

  const plazoDias = await plazoDiasDeJurado(lang);
  const { getLanguageName } = await import("@/lib/pricing-engine/languages");
  const { docTypeLabelEs } = await import("@/lib/lavori-lead");
  const lines = infos.map((info, i) => {
    const row = uniqueRows[i];
    const label = docTypeLabelEs(row.documentType, row.analysisJson) || info.docType.replace(/_/g, " ");
    return {
      description: `${label.charAt(0).toUpperCase()}${label.slice(1)} (${getLanguageName(sourceLang)}→${getLanguageName(targetLang)}${info.words ? `, ${info.words} palabras` : ""}${info.pages ? `, ${info.pages} pág${info.pages === 1 ? "" : "s"}` : ""})`,
      quantity: 1,
      unitPrice: docLines[i].clientCents / 100,
      supplierUnitCost: docLines[i].costCents / 100,
      sourceFileUrl: info.fileUrl,
    };
  });

  const created = await createAutoQuote({
    lines,
    deliveryTerm: closedDeliveryTerm(plazoDias),
    sourceLang,
    targetLang,
    marginPct: verdict.marginPct,
    autoPricedBy: ENCARGO_CERRADO_AUTO_PRICED_BY,
    adminCreatedBy: "system:encargo-cerrado",
    channelPriceSource: "lavori-directo",
    miembro: { id: rule.miembroId, nombre: rule.nombre },
    expedienteRef,
    contacto: {
      email: opts.contactEmail || rows.find((r) => r.clientEmail)?.clientEmail || "",
      phone: opts.contactPhone || rows.find((r) => r.clientPhone)?.clientPhone || "",
      name: opts.contactName || rows.find((r) => r.clientName)?.clientName || "",
    },
    locale: opts.locale,
    send: false,
    ...(opts.casoId !== undefined ? { casoId: opts.casoId } : {}),
  });
  if (!created.ok) return created;

  let sent = false;
  let payUrl: string | null = null;
  let autoSendReasons: string[] = [];
  if (!isEncargoCerradoAutosend(process.env.ENCARGO_CERRADO_AUTOSEND)) {
    autoSendReasons = ["rodaje: ENCARGO_CERRADO_AUTOSEND apagado, lo envías tú"];
  } else if (verdict.overCap) {
    autoSendReasons = [`${(verdict.subtotalCents / 100).toFixed(2)} € netos superan el tope automático de 300 €`];
  } else {
    const { autoSendTarifarioDraft } = await import("@/lib/cierre");
    const out = await autoSendTarifarioDraft(created.quoteId);
    sent = out.sent;
    autoSendReasons = out.reasons;
    payUrl = out.payUrl;
  }

  return {
    ok: true,
    repetido: false,
    quoteId: created.quoteId,
    quoteNumber: created.quoteNumber,
    totalEur: created.totalEur,
    subtotalEur: verdict.subtotalCents / 100,
    costEur: verdict.costCents / 100,
    sent,
    payUrl,
    miembroNombre: rule.nombre,
    plazoDias,
    regla: rule.regla,
    autoSendReasons,
  };
}

/** Al pagar un encargo cerrado: retira las solicitudes de precio que sigan vivas para el
 * mismo caso y par, para que ningún jurado reciba dos veces el mismo trabajo. Si alguna no
 * se puede retirar (ya adjudicada en lavori o fallo de red), el encargo NO sale. */
export async function retireOpenRequestsForClosedQuote(opts: {
  quote: { id: string; casoId: string | null; expedienteRef: string | null };
  par: string;
  reference: string;
  actorEmail: string | null;
}): Promise<{ ok: true; retiradas: string[] } | { ok: false; ref: string; error: string }> {
  const vivas = await prisma.lavoriPriceRequest.findMany({
    where: closedRetireWhere(opts.quote, opts.par),
    select: { id: true, ref: true },
  });
  const { retireLeadRequest } = await import("@/lib/lavori-retire");
  const retiradas: string[] = [];
  for (const lpr of vivas) {
    const r = await retireLeadRequest({
      id: lpr.id,
      actorEmail: opts.actorEmail || "system:encargo-cerrado",
      motivo: `pedido ${opts.reference} pagado con encargo cerrado`,
      terminal: "RETIRED",
      lavoriMotivo: "duplicado",
      allowedStatuses: [...CLOSED_RETIRE_STATUSES],
      relanzar: false,
    });
    if (!r.ok) return { ok: false, ref: lpr.ref, error: r.error };
    retiradas.push(lpr.ref);
  }
  return { ok: true, retiradas };
}
