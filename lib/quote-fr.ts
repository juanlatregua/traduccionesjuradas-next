// lib/quote-fr.ts — Carril FR→ES compartido (agente de bandeja y puerta): segmentos ya
// leídos + contacto → Quote en DRAFT con la tarifa por documento de Juan, más la decisión
// de «¿sale solo?». Un único creador (createAutoQuote); quien llama decide enviar o no.

import { createAutoQuote, autoSendCapCentsWithVat } from "@/lib/learned-rates";
import { evaluateDraftAutoSend } from "@/lib/cierre";
import { decimalToNumber } from "@/lib/quotes";
import { FR_DELIVERY_TERM, FR_TRANSLATOR, priceFrSegments, type SendDecisionLike, type Segment } from "@/lib/agente-bandeja-math";

export type QuoteFrInput = {
  segments: (Segment & { fileUrl: string })[];
  contacto: { email?: string | null; phone?: string | null; name?: string | null };
  expedienteRef: string;
  locale: string;
  autoPricedBy: string;
  actor: string;
  /** Se ejecuta justo tras crear el Quote (p. ej. atar el quoteId al InboundEmail). */
  onQuoteCreated?: (quoteId: string) => Promise<void>;
};

export type QuoteFrItem = { label: string; labelFr?: string | null; pages: number | null };

export type QuoteFrResult =
  | {
      ok: true;
      quoteId: string;
      quote: NonNullable<Awaited<ReturnType<typeof evaluateDraftAutoSend>>["quote"]>;
      items: QuoteFrItem[];
      netEur: number;
      totalEur: number;
      decision: SendDecisionLike;
    }
  | { ok: false; reason: string; quoteId?: string };

/** Decisión de envío solo, con el tope de importe (con IVA) aplicado. Lo usan también los carriles no FR. */
export async function evaluateCapped(quoteId: string, frAllowed: boolean) {
  const ev = await evaluateDraftAutoSend(quoteId, { frAllowed });
  const quote = ev.quote;
  if (!quote) return { quote: null, decision: ev.decision as SendDecisionLike, totalEur: 0, netEur: 0 };
  const totalEur = decimalToNumber(quote.total);
  const netEur = Math.round((decimalToNumber(quote.subtotal) - decimalToNumber(quote.discountAmount)) * 100) / 100;
  const decision: SendDecisionLike =
    ev.decision.action === "send" && Math.round(totalEur * 100) > autoSendCapCentsWithVat()
      ? { action: "alert", reasons: [`${totalEur.toFixed(2)} € con IVA superan el tope de envío solo (${autoSendCapCentsWithVat() / 100} €)`] }
      : (ev.decision as SendDecisionLike);
  return { quote, decision, totalEur, netEur };
}

export async function quoteFr(input: QuoteFrInput): Promise<QuoteFrResult> {
  const fr = priceFrSegments(input.segments);
  if (!fr.ok) return { ok: false, reason: fr.reason };
  const created = await createAutoQuote({
    lines: fr.lines.map((l, i) => ({ description: l.description, quantity: 1, unitPrice: l.unitPrice, supplierUnitCost: 0, sourceFileUrl: input.segments[i].fileUrl })),
    deliveryTerm: FR_DELIVERY_TERM,
    sourceLang: "fr",
    targetLang: "es",
    marginPct: 0,
    autoPricedBy: input.autoPricedBy,
    adminCreatedBy: input.actor,
    channelPriceSource: "fr-tarifa",
    miembro: { id: null, nombre: null },
    translator: FR_TRANSLATOR,
    expedienteRef: input.expedienteRef,
    contacto: input.contacto,
    locale: input.locale,
    send: false,
    onQuoteCreated: input.onQuoteCreated,
  });
  if (!created.ok) return { ok: false, reason: created.reason };
  const ev = await evaluateCapped(created.quoteId, true);
  if (!ev.quote) return { ok: false, reason: "presupuesto no disponible tras crearlo", quoteId: created.quoteId };
  return {
    ok: true,
    quoteId: created.quoteId,
    quote: ev.quote,
    items: fr.lines.map((l, i) => ({ label: l.label, labelFr: input.segments[i].labelFr, pages: l.pages })),
    netEur: ev.netEur,
    totalEur: ev.totalEur,
    decision: ev.decision,
  };
}
