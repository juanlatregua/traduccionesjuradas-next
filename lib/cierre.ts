// lib/cierre.ts — Cierre con el cliente (orden de Juan, 8-oct-2026): del «solicitud
// con precio» al «pedido pagado». Capa de BD sobre lib/cierre-math.ts.
//  · autoSendQuoteForLead: al llegar precio_propuesto, el presupuesto atado SALE SOLO
//    si pasa margen + tope + no-FR + guardas; si no, aviso inmediato email + SMS con
//    enlace de un toque «Revisar y enviar».
//  · deduceLostReasonFor: al caducar sin pago, motivo automático si se puede deducir.
//  · findCostGapOrders: pagados sin coste a las 24 h (vigía + email de pendientes).

import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/quotes";
import { checkQuoteLinesMargin } from "@/lib/quote-margin";
import { findLiveLavoriDuplicate, isHeldByJuan } from "@/lib/lavori-dup-guard";
import { alreadyCustomerFor, loadCustomerIndex } from "@/lib/client-contact-guard";
import { cierreReviewUrl } from "@/lib/cierre-token";
import { decideAutoSend, isRealEmail, deduceLostReason, hasCostGap, hasHumanOpen, autoLostNote, type CostGapOrder } from "@/lib/cierre-math";
import type { AutoLostCode } from "@/lib/quote-lost-reasons";

const SITE = "https://www.traduccionesjuradas.net";

export type AutoSendOutcome =
  | { result: "sent"; quoteNumber: string }
  | { result: "alerted"; quoteNumber: string; reasons: string[] }
  | { result: "skipped"; reason: string };

async function alertStaff(subject: string, lines: string[], smsText: string | null, context: string) {
  const { sendMail } = await import("@/lib/azure-mail");
  const { sendStaffAlertSMS } = await import("@/lib/sms");
  const to = process.env.ADMIN_EMAIL || "info@traduccionesjuradas.net";
  // Dos transportes independientes: el fallo de uno no tumba al otro.
  await Promise.all([
    sendMail({ to, subject, text: lines.join("\n"), html: lines.map((l) => `<p>${l}</p>`).join("") }).catch((e) => console.error("[cierre] mail staff fallo", e)),
    smsText ? sendStaffAlertSMS(smsText, context).catch((e) => console.error("[cierre] SMS staff fallo", e)) : Promise.resolve(),
  ]);
}

/**
 * Llega el precio del jurado y el borrador atado ya está relleno: lo envía solo o avisa.
 * Idempotente: solo actúa sobre un borrador virgen; finalizeAndSendQuote toma su propio
 * candado (sendingAt), así que dos eventos simultáneos no producen dos envíos.
 */
export async function autoSendQuoteForLead(leadId: string, extraAvisos: string[] = []): Promise<AutoSendOutcome> {
  const lead = await prisma.lavoriPriceRequest.findUnique({ where: { id: leadId } });
  if (!lead) return { result: "skipped", reason: "solicitud no encontrada" };
  if (!lead.quoteId) return { result: "skipped", reason: "sin presupuesto atado" };
  if (lead.status !== "PRICED" || !lead.priceCents) return { result: "skipped", reason: "solicitud sin precio" };

  const quote = await prisma.quote.findUnique({ where: { id: lead.quoteId }, include: { lines: { orderBy: { createdAt: "asc" } } } });
  if (!quote || quote.deletedAt) return { result: "skipped", reason: "presupuesto no disponible" };

  const lines = quote.lines.map((l) => ({
    quantity: Number(l.quantity) || 1,
    unitPrice: decimalToNumber(l.unitPrice),
    supplierUnitCost: l.supplierUnitCost == null ? null : decimalToNumber(l.supplierUnitCost),
  }));
  const discountCents = Math.round(decimalToNumber(quote.discountAmount) * 100);
  const margin = checkQuoteLinesMargin({ sourceLang: quote.sourceLang, targetLang: quote.targetLang, lines, discountCents });
  const netCents = Math.round(decimalToNumber(quote.subtotal) * 100) - discountCents;

  // Guardas anti-duplicado: otro encargo vivo con los mismos documentos, otro presupuesto
  // del mismo expediente ya en manos del cliente, y cliente que ya pagó este encargo.
  const dup = await findLiveLavoriDuplicate({ par: lead.par, contentKey: lead.contentKey, expedienteRef: lead.expedienteRef, excludeRef: lead.ref });
  const guards = await quoteDuplicateGuards(quote);
  const duplicate: string | null = dup ? `ya hay otro encargo vivo para estos documentos (${dup.ref}, ${dup.status})` : guards.duplicate;
  const alreadyCustomer = guards.alreadyCustomer;

  const decision = decideAutoSend({
    sourceLang: quote.sourceLang,
    targetLang: quote.targetLang,
    quoteStatus: quote.status,
    sentAt: quote.sentAt,
    sendingAt: quote.sendingAt,
    netCents,
    customerEmail: quote.customerEmail,
    customerPhone: quote.customerPhone,
    marginDetail: margin.ok ? null : margin.detail,
    costMissing: lines.some((l) => l.unitPrice > 0 && !(l.supplierUnitCost && l.supplierUnitCost > 0)),
    heldByJuan: Boolean(lead.heldByJuanAt),
    duplicate,
    alreadyCustomer,
    avisos: extraAvisos,
    leadPar: lead.par,
  });

  if (decision.action === "skip") return { result: "skipped", reason: decision.reason };

  const total = decimalToNumber(quote.total).toFixed(2);
  const cliente = quote.customerName || quote.customerEmail;

  if (decision.action === "send") {
    try {
      // El presupuesto nombra al jurado que cotizó (nombre + MAEC) ANTES de salir: si el
      // borrador traía otro o ninguno, la sync lo corrige (el actor system:* no la bloquea).
      await syncLeadTranslator(lead, quote.id);
      const { finalizeAndSendQuote } = await import("@/lib/quote-send");
      await finalizeAndSendQuote({ quoteId: quote.id, actorEmail: "system:cierre-auto", requireDraft: true });
      await alertStaff(
        `✅ Presupuesto ${quote.quoteNumber} enviado solo a ${cliente}: ${total} € IVA incl.`,
        [`${lead.miembroNombre || "El jurado"} cotizó ${((lead.priceCents ?? 0) / 100).toFixed(2)} € (${lead.par}) y el presupuesto ${quote.quoteNumber} (${total} € con IVA) ha salido al cliente: margen OK, importe ≤ tope y par no FR.`, `Ficha: ${SITE}/zona-traductor/presupuestos/${quote.id}`],
        null, // informativo: solo email; el SMS se reserva para lo que exige acción
        `cierre_enviado ${lead.ref}`
      );
      return { result: "sent", quoteNumber: quote.quoteNumber };
    } catch (err) {
      // 409 de los frenos de margen/canal o fallo de envío: cae a aviso, nunca a override.
      const reason = `el envío automático falló: ${String((err as Error)?.message || err)}`;
      return await alertReview(lead.ref, lead.par, quote, cliente, total, [reason]);
    }
  }

  return await alertReview(lead.ref, lead.par, quote, cliente, total, decision.reasons);
}

/** Guardas anti-duplicado de un presupuesto: otro del mismo expediente ya en manos del cliente, y cliente que ya pagó. */
async function quoteDuplicateGuards(quote: { id: string; expedienteRef: string | null; customerEmail: string; sourceLang: string; targetLang: string }) {
  let duplicate: string | null = null;
  if (quote.expedienteRef) {
    const otro = await prisma.quote.findFirst({
      where: { id: { not: quote.id }, expedienteRef: quote.expedienteRef, deletedAt: null, status: { in: ["SENT", "OPENED", "ACCEPTED", "PAID", "IN_PROGRESS", "DELIVERED"] } },
      select: { quoteNumber: true, status: true },
    });
    if (otro) duplicate = `el mismo expediente ya tiene el presupuesto ${otro.quoteNumber} (${otro.status})`;
  }
  // Misma persona con OTRO presupuesto ya enviado y abierto del mismo par en 72 h (9-oct-2026:
  // 11 casos en 60 días con dos presupuestos enviados): no sale solo, lo revisa Juan.
  if (!duplicate && isRealEmail(quote.customerEmail)) {
    const hermano = await prisma.quote
      .findFirst({
        where: {
          id: { not: quote.id },
          deletedAt: null,
          customerEmail: { equals: quote.customerEmail.trim(), mode: "insensitive" },
          sourceLang: quote.sourceLang,
          targetLang: quote.targetLang,
          status: { in: ["SENT", "OPENED", "ACCEPTED"] },
          sentAt: { gte: new Date(Date.now() - 72 * 3_600_000) },
        },
        select: { quoteNumber: true, status: true },
      })
      .catch(() => null);
    if (hermano) duplicate = `la misma persona ya tiene enviado ${hermano.quoteNumber} (${hermano.status}) del mismo par en las últimas 72 h`;
  }
  let alreadyCustomer: string | null = null;
  try {
    const index = await loadCustomerIndex({ since: new Date(), emails: [quote.customerEmail], expedienteRefs: [quote.expedienteRef || ""] });
    const ya = alreadyCustomerFor({ mode: "encargo", expedienteRef: quote.expedienteRef, quoteId: quote.id }, { index });
    if (ya.skip) alreadyCustomer = `${ya.reason} ${ya.ref}`;
  } catch (err) {
    // Sin poder consultar la guarda, no se envía solo: mejor un aviso que un doble cobro.
    alreadyCustomer = `no se pudo consultar la guarda de clientes (${String((err as Error)?.message || err)})`;
  }
  return { duplicate, alreadyCustomer };
}

/**
 * Borrador del TARIFARIO APRENDIDO (puerta, sin solicitud a lavori) → se envía solo si pasa
 * las mismas guardas que el cierre por precio de jurado. Detrás de LEARNED_RATES_AUTOSEND=on
 * (lo llama learned-rates.ts). Nunca lanza: si algo falla, el borrador queda para Juan.
 * finalizeAndSendQuote añade el freno de margen y la procedencia (channelPriceSource
 * "learned-rate") y requireDraft + candado evitan el doble envío.
 */
export async function autoSendTarifarioDraft(quoteId: string): Promise<{ sent: boolean; reasons: string[]; payUrl: string | null }> {
  try {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { lines: { orderBy: { createdAt: "asc" } } } });
    if (!quote || quote.deletedAt) return { sent: false, reasons: ["presupuesto no disponible"], payUrl: null };
    const lines = quote.lines.map((l) => ({ quantity: Number(l.quantity) || 1, unitPrice: decimalToNumber(l.unitPrice), supplierUnitCost: l.supplierUnitCost == null ? null : decimalToNumber(l.supplierUnitCost) }));
    const discountCents = Math.round(decimalToNumber(quote.discountAmount) * 100);
    const margin = checkQuoteLinesMargin({ sourceLang: quote.sourceLang, targetLang: quote.targetLang, lines, discountCents });
    const netCents = Math.round(decimalToNumber(quote.subtotal) * 100) - discountCents;
    const guards = await quoteDuplicateGuards(quote);
    const decision = decideAutoSend({
      sourceLang: quote.sourceLang,
      targetLang: quote.targetLang,
      quoteStatus: quote.status,
      sentAt: quote.sentAt,
      sendingAt: quote.sendingAt,
      netCents,
      customerEmail: quote.customerEmail,
      customerPhone: quote.customerPhone,
      marginDetail: margin.ok ? null : margin.detail,
      costMissing: lines.some((l) => l.unitPrice > 0 && !(l.supplierUnitCost && l.supplierUnitCost > 0)),
      heldByJuan: false,
      duplicate: guards.duplicate,
      alreadyCustomer: guards.alreadyCustomer,
    });
    if (decision.action === "skip") return { sent: false, reasons: [decision.reason], payUrl: null };
    if (decision.action === "alert") return { sent: false, reasons: decision.reasons, payUrl: null };
    const { finalizeAndSendQuote } = await import("@/lib/quote-send");
    const out = await finalizeAndSendQuote({ quoteId: quote.id, actorEmail: "system:tarifario-auto", channelPriceSource: "learned-rate", requireDraft: true });
    return { sent: true, reasons: [], payUrl: out.payUrl };
  } catch (err) {
    return { sent: false, reasons: [`el envío automático falló: ${String((err as Error)?.message || err)}`], payUrl: null };
  }
}

async function syncLeadTranslator(lead: { miembroId: string | null; miembroNombre: string | null }, quoteId: string) {
  if (!lead.miembroNombre) return;
  try {
    const { LAVORI_MEMBER_COLLABORATOR_EMAIL } = await import("@/lib/lavori-bridge");
    const { syncQuoteTranslatorWithAcceptor } = await import("@/lib/lavori-assign");
    const email = lead.miembroId ? LAVORI_MEMBER_COLLABORATOR_EMAIL[lead.miembroId] : undefined;
    const colab = email ? await prisma.collaborator.findUnique({ where: { email }, select: { fullName: true, swornNumber: true } }) : null;
    await syncQuoteTranslatorWithAcceptor({ quoteId, nombre: colab?.fullName || lead.miembroNombre, maec: colab?.swornNumber ?? null, miembroId: lead.miembroId, soloSinEnviar: true });
  } catch (err) {
    console.error("[cierre] sync jurado antes del envío falló", err);
  }
}

async function alertReview(
  ref: string,
  par: string,
  quote: { id: string; quoteNumber: string },
  cliente: string,
  total: string,
  reasons: string[]
): Promise<AutoSendOutcome> {
  const url = cierreReviewUrl(quote.id);
  await alertStaff(
    `🧾 Precio recibido: revisa y envía ${quote.quoteNumber} (${par}, ${total} €)`,
    [`Ha llegado el precio del jurado para ${cliente} (${par}) y el presupuesto ${quote.quoteNumber} (${total} € con IVA) NO ha salido solo:`, ...reasons.map((r) => `• ${r}`), `Revisar y enviar (un toque): ${url}`],
    `Precio listo, ${quote.quoteNumber} (${par}, ${total}€) NO sale solo: ${reasons[0]}. Revisar y enviar: ${url}`,
    `cierre_revisar ${ref}`
  );
  return { result: "alerted", quoteNumber: quote.quoteNumber, reasons };
}

/* ───────────── Motivo de pérdida ───────────── */

/**
 * Deduce el motivo de un presupuesto que caduca sin pago y lo guarda en lostReasonNote
 * (lostReason es enum; ver lib/quote-lost-reasons.ts). Nunca pisa un motivo ya dado.
 * Devuelve el código deducido o null (abrió y no pagó → tarea de Juan en el vigía).
 */
export async function deduceLostReasonFor(quoteId: string): Promise<AutoLostCode | null> {
  const q = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { id: true, expedienteRef: true, customerEmail: true, sourceLang: true, targetLang: true, sentAt: true, openedAt: true, lostReason: true, lostReasonNote: true, accessEvents: { select: { userAgent: true } } },
  });
  if (!q || q.lostReason || q.lostReasonNote) return null;
  const replacedByPaid = await hasPaidSibling(q);
  const code = deduceLostReason({ replacedByPaid, humanOpened: Boolean(q.openedAt) || hasHumanOpen(q.accessEvents) });
  if (!code) return null;
  await prisma.quote.updateMany({ where: { id: q.id, lostReason: null, lostReasonNote: null }, data: { lostReasonNote: autoLostNote(code) } });
  return code;
}

/** El cliente pagó OTRO presupuesto del mismo encargo (mismo expediente) o del mismo par tras recibir este. */
export async function hasPaidSibling(q: { id: string; expedienteRef: string | null; customerEmail: string; sourceLang: string | null; targetLang: string | null; sentAt: Date | null }): Promise<boolean> {
  const paid = { OR: [{ paidAt: { not: null } }, { status: { in: ["PAID" as const, "IN_PROGRESS" as const, "DELIVERED" as const] } }] };
  if (q.expedienteRef) {
    const n = await prisma.quote.count({ where: { id: { not: q.id }, expedienteRef: q.expedienteRef, deletedAt: null, ...paid } });
    if (n > 0) return true;
  }
  if (q.sentAt && q.sourceLang && q.targetLang) {
    const n = await prisma.quote.count({
      where: { id: { not: q.id }, customerEmail: { equals: q.customerEmail, mode: "insensitive" }, sourceLang: q.sourceLang, targetLang: q.targetLang, deletedAt: null, createdAt: { gte: q.sentAt }, ...paid },
    });
    if (n > 0) return true;
  }
  return false;
}

/* ───────────── Alarma de coste ───────────── */

export const COST_GAP_SELECT = {
  reference: true, paymentStatus: true, status: true, paidAt: true, langPair: true, assignedTo: true, supplierCostCents: true, amountCents: true, clientName: true, clientEmail: true,
  collaboratorAssignments: { select: { isWinning: true, status: true, quotedPriceCents: true } },
} as const;

/** Pedidos pagados hace ≥24 h (ventana 60 d) sin coste registrado. Solo lectura. */
export async function findCostGapOrders(now = new Date()) {
  const rows = await prisma.order.findMany({
    where: { paymentStatus: "PAID", paidAt: { gte: new Date(now.getTime() - 60 * 864e5), lte: new Date(now.getTime() - 24 * 3_600_000) }, supplierCostCents: null, status: { not: "CANCELLED" } },
    orderBy: { paidAt: "asc" },
    select: COST_GAP_SELECT,
    take: 200,
  });
  return rows.filter((o) => hasCostGap({ ...o, assignments: o.collaboratorAssignments } as CostGapOrder, now));
}
