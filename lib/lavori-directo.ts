// lib/lavori-directo.ts — FUNNEL DIRECTO tj.net→lavori (Juan, 15-sep-2026).
//
// Para ciertas lenguas hay un jurado DIRECTO. La puerta le lanza la solicitud
// de precio SOLO a él; cuando su precio_propuesto llega (cifra + plazo), tj.net
// monta el presupuesto con +20 % sobre la BASE del jurado (suelo 40 €/doc) y lo
// ENVÍA solo si el subtotal neto ≤ 300 €. Si el directo no cotiza en 6 h, la
// solicitud se reabre a todos los jurados de la lengua (escalateStaleDirectRequests,
// cron). SOLO SERVIDOR (Prisma).

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { sendStaffAlertSMS } from "@/lib/sms";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { getLanguageName } from "@/lib/pricing-engine/languages";
import {
  LAVORI_MEMBER_COLLABORATOR_EMAIL,
  fetchLavoriCartera,
  isLavoriMemberAvailable,
  pickLavoriAuto,
} from "@/lib/lavori-bridge";
import { docTypeLabelEs, leadFromPuertaSession, sendLeadPriceRequest } from "@/lib/lavori-lead";
import { ANALYSIS_SELECT, createAutoQuote } from "@/lib/learned-rates";
import { canAutoQuote } from "@/lib/learned-rates-math";
import {
  DIRECT_AUTO_MAX_CENTS,
  DIRECT_FALLBACK_HOURS,
  DIRECT_MARGIN_PCT,
  channelPriceToBaseCents,
  directQuoteLines,
  isAnomalousPrice,
  type PriceBasis,
} from "@/lib/lavori-directo-math";

export type { PriceBasis };

const STAFF_ALERT_EMAIL = process.env.ADMIN_EMAIL || "info@traduccionesjuradas.net";

export const LAVORI_DIRECT: Record<string, { miembroId: string; nombre: string; priceBasis: PriceBasis; enabled: boolean }> = {
  nl: { miembroId: "a2x1faeg08r1tiz4gt1d6hfv", nombre: "Daniela Cleintuar", priceBasis: "payable_iva_irpf", enabled: true },
  de: { miembroId: "ngus1uku6x5uw2pqbmflpbbt", nombre: "Morton Sebastian Peter Münster", priceBasis: "base", enabled: true },
  en: { miembroId: "exwzhhwv5fyegllvblt76uvb", nombre: "María Lourdes Yagüe", priceBasis: "base", enabled: true },
  ro: { miembroId: "8npqw6hd5vavn4maio2173lq", nombre: "Maria Murariu", priceBasis: "base", enabled: true },
  // Ya tiene Collaborator (alta 15-sep) pero apagado a propósito: hasta que
  // Miguel confirme si su cifra es base o líquido (orden Juan 15-sep-2026).
  it: { miembroId: "k1obdgqfpxszjzr4za8rnc7x", nombre: "Miguel Ros González", priceBasis: "base", enabled: false },
};

/** ¿Este idioma tiene jurado directo operativo HOY? Gates: kill-switch por env
 * (LAVORI_DIRECTO=off, o lista "nl,de" que no incluya la lengua), Collaborator
 * mapeado en tj.net y disponibilidad viva en el tablón de lavori. */
export async function directMemberFor(
  lang: string
): Promise<{ miembroId: string; nombre: string; priceBasis: PriceBasis; enabled: boolean } | null> {
  const l = String(lang || "").trim().toLowerCase();
  const cfg = LAVORI_DIRECT[l];
  if (!cfg || !cfg.enabled) return null;
  const raw = String(process.env.LAVORI_DIRECTO || "").trim().toLowerCase();
  if (raw === "off") return null;
  if (raw) {
    const langs = new Set(raw.split(",").map((x) => x.trim()).filter(Boolean));
    if (!langs.has(l)) return null;
  }
  const email = LAVORI_MEMBER_COLLABORATOR_EMAIL[cfg.miembroId];
  if (!email) return null;
  const collaborator = await prisma.collaborator.findUnique({ where: { email }, select: { id: true } });
  if (!collaborator) return null;
  const disp = await isLavoriMemberAvailable(l, cfg.miembroId);
  if (!disp.ok) return null;
  return cfg;
}

/** priceBasis del jurado por su miembroId, mire o no el kill-switch/enabled —
 * lo usa la contabilidad (assignLavoriAcceptance) y la guardia de "cifra
 * cambiada tras enviar" (workflow-server), que se aplican a CUALQUIER
 * presupuesto atado, directo o no. "base" por defecto: sin dato mejor, no se
 * inventa una conversión que no le corresponde. */
export function priceBasisForMember(miembroId: string | null | undefined): PriceBasis {
  const id = String(miembroId || "").trim();
  if (!id) return "base";
  const cfg = Object.values(LAVORI_DIRECT).find((c) => c.miembroId === id);
  return cfg?.priceBasis ?? "base";
}

function parsePar(par: string): { lang: string; sourceLang: string; targetLang: string } | null {
  const p = String(par || "").trim().toUpperCase();
  let m = /^([A-Z]{2,3})>ES$/.exec(p);
  if (m) return { lang: m[1].toLowerCase(), sourceLang: m[1].toLowerCase(), targetLang: "es" };
  m = /^ES>([A-Z]{2,3})$/.exec(p);
  if (m) return { lang: m[1].toLowerCase(), sourceLang: "es", targetLang: m[1].toLowerCase() };
  return null;
}

export type AutoQuoteFromDirectPriceResult =
  | { ok: true; sent: boolean; quoteId: string; quoteNumber: string; totalEur: number; reason?: string }
  | { ok: false; reason: string };

/** El precio del jurado DIRECTO ya llegó (precio_propuesto): monta el presupuesto
 * con +20 % sobre su base y lo envía si cabe en el tope y no es anómalo. */
export async function autoQuoteFromDirectPrice(leadId: string): Promise<AutoQuoteFromDirectPriceResult> {
  const lead = await prisma.lavoriPriceRequest.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, reason: "solicitud no encontrada" };
  if (lead.status !== "PRICED" || !lead.priceCents || lead.priceCents <= 0) {
    return { ok: false, reason: "solicitud sin precio" };
  }
  if (!lead.plazoDias || lead.plazoDias <= 0) {
    return { ok: false, reason: "el jurado no dio plazo: sin plazo no se emite solo" };
  }
  if (!lead.expedienteRef || !lead.expedienteRef.startsWith("puerta:")) {
    return { ok: false, reason: "solicitud sin expediente de la puerta" };
  }
  const parsed = parsePar(lead.par);
  if (!parsed) return { ok: false, reason: `par no reconocido: ${lead.par}` };
  const { lang, sourceLang, targetLang } = parsed;
  const config = LAVORI_DIRECT[lang];
  if (!config || !config.enabled || config.miembroId !== lead.miembroId) {
    return { ok: false, reason: "el jurado que cotizó no es el directo configurado para esta lengua" };
  }

  const token = lead.expedienteRef.slice("puerta:".length);
  const rows = await prisma.documentAnalysis.findMany({
    where: { sessionToken: token, fileUrl: { not: "" } },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { ...ANALYSIS_SELECT, clientName: true, clientEmail: true, clientPhone: true },
  });
  if (rows.length === 0) return { ok: false, reason: "sesión sin documentos" };
  // Misma deduplicación que autoQuoteFromPuertaSession (lib/learned-rates.ts):
  // el mismo archivo subido dos veces cuenta una vez.
  const seen = new Set<string>();
  const uniqueRows = rows.filter((r) => {
    const k = `${r.fileName}|${r.estimatedWords}|${r.pageCount}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const baseCents = channelPriceToBaseCents(lead.priceCents, config.priceBasis);
  const docLines = directQuoteLines(baseCents, uniqueRows.map((r) => ({ words: r.estimatedWords ?? null })));

  for (let i = 0; i < docLines.length; i++) {
    if (!canAutoQuote(docLines[i].clientCents, docLines[i].costCents)) {
      return {
        ok: false,
        reason: `margen insuficiente en documento ${i + 1}: cliente ${(docLines[i].clientCents / 100).toFixed(2)} € − coste ${(docLines[i].costCents / 100).toFixed(2)} €`,
      };
    }
  }

  const disp = await isLavoriMemberAvailable(lang, config.miembroId);
  if (!disp.ok) {
    return { ok: false, reason: `${config.nombre} no puede recibir el encargo ahora: ${disp.reason}` };
  }

  const totalWords = uniqueRows.reduce((a, r) => a + (r.estimatedWords || 0), 0) || lead.words || null;
  const historial = await prisma.lavoriPriceRequest.findMany({
    where: { miembroId: lead.miembroId, status: { in: ["PRICED", "ACCEPTED"] }, words: { gt: 0 }, priceCents: { not: null }, id: { not: lead.id } },
    select: { priceCents: true, words: true },
    take: 200,
  });
  const historyCentsPerWord = historial
    .filter((h) => h.priceCents && h.words)
    .map((h) => (h.priceCents as number) / (h.words as number));
  const centsPerWord = totalWords ? lead.priceCents / totalWords : null;
  const anomalo = centsPerWord != null && isAnomalousPrice(centsPerWord, historyCentsPerWord);

  const subtotalCents = docLines.reduce((a, l) => a + l.clientCents, 0);
  const overCap = subtotalCents > DIRECT_AUTO_MAX_CENTS;
  const holdReason = overCap
    ? `importe ${(subtotalCents / 100).toFixed(2)} € por encima del tope del funnel directo (${(DIRECT_AUTO_MAX_CENTS / 100).toFixed(2)} €)`
    : anomalo
      ? `precio de ${config.nombre} anómalo frente a su historial (${(centsPerWord! ).toFixed(2)} cent./palabra)`
      : undefined;

  const lines = uniqueRows.map((row, i) => {
    const label = docTypeLabelEs(row.documentType, row.analysisJson) || "documento";
    const words = row.estimatedWords;
    const pages = row.pageCount;
    const desc = `${label.charAt(0).toUpperCase()}${label.slice(1)} (${getLanguageName(sourceLang)}→${getLanguageName(targetLang)}${words ? `, ${words} palabras` : ""}${pages ? `, ${pages} pág${pages === 1 ? "" : "s"}` : ""})`;
    return {
      description: desc,
      quantity: 1,
      unitPrice: docLines[i].clientCents / 100,
      supplierUnitCost: docLines[i].costCents / 100,
      sourceFileUrl: row.fileUrl,
    };
  });

  const deliveryTerm = `${lead.plazoDias}-${lead.plazoDias + 1} días hábiles`;
  const result = await createAutoQuote({
    lines,
    deliveryTerm,
    sourceLang,
    targetLang,
    marginPct: DIRECT_MARGIN_PCT,
    autoPricedBy: "lavori-directo",
    adminCreatedBy: "system:lavori-directo",
    channelPriceSource: "lavori-directo",
    miembro: { id: lead.miembroId, nombre: lead.miembroNombre ?? config.nombre },
    expedienteRef: lead.expedienteRef,
    contacto: {
      email: rows.find((r) => r.clientEmail)?.clientEmail || "",
      phone: rows.find((r) => r.clientPhone)?.clientPhone || "",
      name: rows.find((r) => r.clientName)?.clientName || "",
    },
    locale: null,
    send: !holdReason,
    onQuoteCreated: async (quoteId) => {
      await prisma.lavoriPriceRequest.update({ where: { id: lead.id }, data: { quoteId } });
    },
  });
  if (!result.ok) return result;

  return {
    ok: true,
    sent: result.sent,
    quoteId: result.quoteId,
    quoteNumber: result.quoteNumber,
    totalEur: result.totalEur,
    ...(holdReason ? { reason: holdReason } : {}),
  };
}

export type EscalateStaleDirectResult = {
  ok: true;
  escaladas: number;
  fallidas: number;
  atascadas: number;
  dosVivas: number;
  detalle: Array<{ refVieja: string; refNueva: string | null; a: string[] | null; error?: string }>;
};

const MAX_ESCALACIONES_POR_EJECUCION = 5;
const ATASCADA_COTIZANDO_MIN = 15;

async function avisarStaffIndividual(texto: string, subject: string, smsContext: string) {
  await Promise.all([
    sendMail({ to: STAFF_ALERT_EMAIL, subject, text: texto, html: renderSimpleEmailHtml(texto) }).catch((err) =>
      console.error("[lavori-directo] aviso individual fallo:", err)
    ),
    sendStaffAlertSMS(texto, smsContext).catch(() => {}),
  ]);
}

/** Solicitudes SENT del carril directo con más de 6 h sin cifra: se reabren a
 * todos los jurados de la lengua (menos el directo). Solo corre en horario
 * laboral (08:00-21:00 Europe/Madrid), como el resto de avisos a staff. Además
 * (MEDIA 4) barre las que se quedaron a medias en "cotizando" sin resolverse. */
export async function escalateStaleDirectRequests(now: Date = new Date()): Promise<EscalateStaleDirectResult | { ok: true; escaladas: 0; skipped: string }> {
  const horaMadrid = Number(
    new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(now)
  );
  if (horaMadrid < 8 || horaMadrid >= 21) {
    return { ok: true, escaladas: 0, skipped: "fuera de horario (08:00-21:00 Europe/Madrid)" };
  }

  // MEDIA 4 (Juan, 15-sep-2026): solicitudes que se quedaron a medias
  // "cotizando" (el proceso se cortó antes de resolver enviado/retenido/manual)
  // — más de 15 min sin resolverse no pueden quedarse invisibles. Dos casos:
  // con quoteId (el Quote SÍ se llegó a crear, solo falta revisarlo/enviarlo)
  // → retenido; sin quoteId (no llegó ni a crear el Quote) → manual.
  const limiteAtascadas = new Date(now.getTime() - ATASCADA_COTIZANDO_MIN * 60 * 1000);
  const atascadas = await prisma.lavoriPriceRequest.findMany({
    where: { createdBy: "puerta-directo:cotizando", updatedAt: { lt: limiteAtascadas } },
    take: 20,
  });
  let atascadasResueltas = 0;
  for (const lpr of atascadas) {
    let count = 0;
    const destino = lpr.quoteId ? "puerta-directo:retenido" : "puerta-directo:manual";
    try {
      const claim = await prisma.lavoriPriceRequest.updateMany({
        where: { id: lpr.id, createdBy: "puerta-directo:cotizando", quoteId: lpr.quoteId },
        data: { createdBy: destino },
      });
      count = claim.count;
    } catch (err) {
      console.error("[lavori-directo] claim atascada fallo:", err);
    }
    if (count === 0) continue;
    atascadasResueltas++;
    const enlace = lpr.quoteId
      ? `https://www.traduccionesjuradas.net/zona-traductor/presupuestos/${lpr.quoteId}`
      : `https://www.traduccionesjuradas.net/zona-traductor/presupuesto?lead=${encodeURIComponent(lpr.ref)}`;
    await avisarStaffIndividual(
      lpr.quoteId
        ? `El presupuesto de la solicitud directa ${lpr.ref} se quedó a medias — revísalo y envíalo: ${enlace}`
        : `La solicitud directa ${lpr.ref} se quedó a medias cotizando — móntala a mano: ${enlace}`,
      `⚠ Solicitud directa atascada: ${lpr.ref}`,
      `directo_atascada ${lpr.ref}`
    );
  }

  // MEDIA 4(b): igual pero en el estado transitorio de la REAPERTURA (el claim
  // que marca "escalando" antes de llamar a lavori) — si se corta ahí, nunca
  // llega a "escalado" ni a "escalado_fallido" por sí sola.
  const atascadasEscalando = await prisma.lavoriPriceRequest.findMany({
    where: { createdBy: "puerta-directo:escalando", updatedAt: { lt: limiteAtascadas } },
    take: 20,
  });
  for (const lpr of atascadasEscalando) {
    let count = 0;
    try {
      const claim = await prisma.lavoriPriceRequest.updateMany({
        where: { id: lpr.id, createdBy: "puerta-directo:escalando" },
        data: { createdBy: "puerta-directo:escalado_fallido" },
      });
      count = claim.count;
    } catch (err) {
      console.error("[lavori-directo] claim atascada escalando fallo:", err);
    }
    if (count === 0) continue;
    atascadasResueltas++;
    await avisarStaffIndividual(
      `La reapertura de ${lpr.ref} se quedó a medias — pídela a mano en lavori.`,
      `⚠ Reapertura atascada: ${lpr.ref}`,
      `directo_atascada_escalando ${lpr.ref}`
    );
  }

  const limite = new Date(now.getTime() - DIRECT_FALLBACK_HOURS * 60 * 60 * 1000);
  const stale = await prisma.lavoriPriceRequest.findMany({
    where: { createdBy: "puerta-directo", status: "SENT", createdAt: { lt: limite } },
    take: MAX_ESCALACIONES_POR_EJECUCION,
  });

  const detalle: EscalateStaleDirectResult["detalle"] = [];
  let fallidas = 0;
  let dosVivas = 0;
  for (const lpr of stale) {
    // Claim atómico + nota "reabriendo…" ANTES de tocar lavori: si otra
    // invocación (o el propio staff) ya la tocó, se salta.
    let claimCount = 0;
    try {
      const claim = await prisma.lavoriPriceRequest.updateMany({
        where: { id: lpr.id, createdBy: "puerta-directo", status: "SENT" },
        data: { createdBy: "puerta-directo:escalando", notas: "reabriendo…" },
      });
      claimCount = claim.count;
    } catch (err) {
      console.error("[lavori-directo] claim escalado fallo:", err);
    }
    if (claimCount === 0) continue;

    const marcarFallida = async (error: string) => {
      fallidas++;
      await prisma.lavoriPriceRequest
        .update({ where: { id: lpr.id }, data: { createdBy: "puerta-directo:escalado_fallido", status: "SENT" } })
        .catch((err) => console.error("[lavori-directo] marcar fallida fallo:", err));
      detalle.push({ refVieja: lpr.ref, refNueva: null, a: null, error });
      await avisarStaffIndividual(
        `No se pudo reabrir ${lpr.ref} a todos los jurados de la lengua: ${error}. Pídelo a mano.`,
        `⚠ No se pudo reabrir ${lpr.ref}`,
        `directo_reabrir_fallo ${lpr.ref}`
      );
    };

    try {
      const token = lpr.expedienteRef?.startsWith("puerta:") ? lpr.expedienteRef.slice("puerta:".length) : null;
      const lead = token ? await leadFromPuertaSession(token) : null;
      if (!lead || !lead.sourceLang) {
        await marcarFallida("no se pudo reconstruir la sesión de la puerta");
        continue;
      }
      const leadLang = (lead.sourceLang === "es" ? lead.targetLang : lead.sourceLang) as string;
      const cartera = await fetchLavoriCartera(leadLang);
      const directoIds = new Set(lpr.candidatos);
      const candidatosLengua = pickLavoriAuto(leadLang, cartera.miembros)
        .map((m) => m.id)
        .filter((id) => !directoIds.has(id));
      if (candidatosLengua.length === 0) {
        await marcarFallida("sin jurados de respaldo en la cartera");
        continue;
      }
      const nueva = await sendLeadPriceRequest({
        docs: lead.docs,
        sourceLang: lead.sourceLang,
        targetLang: lead.targetLang,
        words: lead.words,
        expedienteRef: lpr.expedienteRef,
        customerHint: lpr.customerHint,
        candidatos: candidatosLengua,
        createdBy: "directo-escalado",
      });
      if (!nueva.ok) {
        await marcarFallida(nueva.error);
        continue;
      }
      // ALTA 2(a) + ALTA 2(c) (Juan, 15-sep-2026): status ESCALATED (terminal,
      // fuera de LEAD_LIVE_STATUSES y LEAD_PAIRABLE_STATUSES) + la ref nueva en
      // notas, pero SOLO si sigue en SENT: si el directo cotizó justo mientras
      // se reabría, el receptor ya la movió a PRICED con una cifra real — no se
      // pisa nada, hay dos solicitudes vivas y decide staff.
      const finalizar = await prisma.lavoriPriceRequest.updateMany({
        where: { id: lpr.id, status: "SENT" },
        data: { createdBy: "puerta-directo:escalado", status: "ESCALATED", notas: `reabierta:${nueva.ref}` },
      });
      if (finalizar.count === 0) {
        dosVivas++;
        detalle.push({ refVieja: lpr.ref, refNueva: nueva.ref, a: nueva.nombres, error: "dos solicitudes vivas — revisar a mano" });
        await avisarStaffIndividual(
          `${lpr.ref} cotizó justo mientras se reabría: ahora hay DOS solicitudes vivas (${lpr.ref} y ${nueva.ref}, enviada a ${nueva.nombres.join(", ")}). Decide tú cuál usar.`,
          `⚠ Dos solicitudes vivas: ${lpr.ref} y ${nueva.ref}`,
          `directo_dos_vivas ${lpr.ref}`
        );
        continue;
      }
      detalle.push({ refVieja: lpr.ref, refNueva: nueva.ref, a: nueva.nombres });
    } catch (err: any) {
      await marcarFallida(String(err?.message || err));
    }
  }

  const exitosas = detalle.filter((d) => !d.error);
  if (exitosas.length > 0) {
    const lineas = exitosas.map((d) => `${d.refVieja} → ${d.refNueva} reabierta a: ${d.a?.join(", ")}.`);
    await sendMail({
      to: STAFF_ALERT_EMAIL,
      subject: `⏱ ${exitosas.length} solicitud(es) del carril directo sin cotizar en ${DIRECT_FALLBACK_HOURS} h — reabiertas`,
      text: lineas.join("\n"),
      html: renderSimpleEmailHtml(lineas.join("\n")),
    }).catch((err) => console.error("[lavori-directo] aviso escalado fallo:", err));
  }

  return { ok: true, escaladas: exitosas.length, fallidas, atascadas: atascadasResueltas, dosVivas, detalle };
}
