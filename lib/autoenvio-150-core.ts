// Autoenvío a las 2,5 h (orden de Juan, 21-nov-2026: el cliente decide en ~3 h). Un BORRADOR
// nacido de la puerta / bandeja / encargo cerrado, no FR, que Juan no ha tocado a los 150 min de
// la llegada del cliente, sale solo si pasa TODAS las guardas; si no, queda en borrador y el
// informe horario lo marca. Decisión PURA; la consulta y el envío en lib/autoenvio-150.ts.
// Interruptor AUTOENVIO_150=on (exacto).
import { MIN_AUTO_MARGIN_PCT } from "./learned-rates-math.ts";

export const AUTOENVIO_MIN = 150;
/** Además, el borrador lleva al menos esto creado: Juan tiene margen para verlo. */
export const AUTOENVIO_MIN_DRAFT_AGE_MIN = 60;
export const AUTOENVIO_MAX_HOURS = 24;
export const AUTOENVIO_MAX_NET_CENTS = 30000;
/** Una edición posterior a esto tras la creación = Juan (o alguien) lo ha tocado. */
export const TOUCH_TOLERANCE_MS = 5 * 60_000;
export const AUTOENVIO_FROM_HOUR = 8;
export const AUTOENVIO_UNTIL_HOUR = 22;

export const autoenvio150On = (env: Record<string, string | undefined> = process.env) => env.AUTOENVIO_150 === "on";

/** Quién crea el borrador → de dónde sale el precio. Solo estos carriles; el resto (constructor, estimador) es de Juan. */
export const AUTOENVIO_ORIGINS: Record<string, { autoPricedBy: string; channel: "learned-rate" | "lavori-directo"; fuente: string }> = {
  "system:tarifario": { autoPricedBy: "tarifario", channel: "learned-rate", fuente: "tarifa aprobada (LearnedRate APPROVED)" },
  "system:encargo-cerrado": { autoPricedBy: "encargo-cerrado", channel: "lavori-directo", fuente: "regla del encargo cerrado" },
  "system:lavori-directo": { autoPricedBy: "lavori-directo", channel: "lavori-directo", fuente: "cifra del jurado (directo)" },
};

/** Hora a la que saldría solo: 150 min tras la llegada y 60 min tras crear el borrador. */
export function autoSendAt(leadAt: Date, draftCreatedAt: Date): Date {
  return new Date(Math.max(leadAt.getTime() + AUTOENVIO_MIN * 60_000, draftCreatedAt.getTime() + AUTOENVIO_MIN_DRAFT_AGE_MIN * 60_000));
}

export const isFrPairLoose = (s: string | null | undefined, t: string | null | undefined) => FR(s, t);

const FR = (s: string | null | undefined, t: string | null | undefined) => [s, t].some((x) => String(x || "").toLowerCase() === "fr");

export type AutoenvioInput = {
  now: Date;
  quote: {
    status: string;
    sentAt: Date | null;
    sendingAt: Date | null;
    deletedAt?: Date | null;
    sourceLang: string | null;
    targetLang: string | null;
    adminCreatedBy: string | null;
    autoPricedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    customerEmail: string | null;
  };
  lines: { quantity: number; unitPrice: number; supplierUnitCost: number | null }[];
  discountCents: number;
  /** Llegada del cliente (primera subida, entrada o email); null = no se encuentra. */
  leadAt: Date | null;
  consent: boolean;
  readingDoubt: string | null;
  /** Otro presupuesto/pedido vivo o enviado para ese caso+par o esa persona. */
  otherLive: string | null;
  claimed: boolean;
  /** Frenos que dio el carril al crear el borrador (avisos del cierre, tarifario, encargo cerrado, bandeja). */
  carrilReasons: string[];
  /** Juan pulsó «Retener». */
  retained: boolean;
  /** Interruptor de rodaje del carril: tarifario = LEARNED_RATES_AUTOSEND=on y tarifario vivo; encargo cerrado = ENCARGO_CERRADO_AUTOSEND=on. */
  carrilOn: { ok: true } | { ok: false; reason: string };
  /** Tarifario: las LearnedRate del presupuesto siguen APPROVED ahora (null = no aplica). */
  rateApproved: boolean | null;
  /** Decisión de las guardas de cierre (margen, tope, duplicados, ya cliente, dijo que no). */
  guards: { action: "send" } | { action: "skip"; reason: string } | { action: "alert"; reasons: string[] };
};

export type AutoenvioVerdict = { action: "ignore"; reason: string } | { action: "wait" } | { action: "hold"; reasons: string[] } | { action: "send"; channel: "learned-rate" | "lavori-directo" };

export function autoenvioVerdict(i: AutoenvioInput): AutoenvioVerdict {
  const q = i.quote;
  if (q.deletedAt || q.status !== "DRAFT" || q.sentAt) return { action: "ignore", reason: "ya no es borrador" };
  if (q.sendingAt) return { action: "ignore", reason: "se está enviando" };
  if (i.claimed) return { action: "ignore", reason: "ya se intentó (nunca dos veces)" };
  if (FR(q.sourceLang, q.targetLang)) return { action: "ignore", reason: "francés: lo lleva PUERTA_FR" };
  const origin = AUTOENVIO_ORIGINS[String(q.adminCreatedBy || "")];
  if (!origin) return { action: "ignore", reason: "no nace de la puerta/bandeja/encargo cerrado" };
  if (!i.leadAt) return { action: "hold", reasons: ["no se encuentra la llegada del cliente"] };
  const age = i.now.getTime() - i.leadAt.getTime();
  if (age > AUTOENVIO_MAX_HOURS * 36e5) return { action: "ignore", reason: "lead de hace más de 24 h" };
  if (i.now.getTime() < autoSendAt(i.leadAt, q.createdAt).getTime()) return { action: "wait" };

  const reasons: string[] = [];
  if (i.retained) reasons.push("retenido por Juan");
  reasons.push(...i.carrilReasons);
  if (!i.carrilOn.ok) reasons.push(i.carrilOn.reason);
  if (i.rateApproved === false) reasons.push("la tarifa aprendida ya no está APPROVED");
  if (q.updatedAt.getTime() - q.createdAt.getTime() > TOUCH_TOLERANCE_MS) reasons.push("editado tras crearse: lo ha tocado alguien");
  if (q.autoPricedBy !== origin.autoPricedBy) reasons.push(`precio sin procedencia aprobada (${q.autoPricedBy || "a mano"})`);
  const net = Math.round(i.lines.reduce((s, l) => s + l.unitPrice * l.quantity * 100, 0)) - i.discountCents;
  const cost = Math.round(i.lines.reduce((s, l) => s + (l.supplierUnitCost || 0) * l.quantity * 100, 0));
  if (i.lines.length === 0 || i.lines.some((l) => l.unitPrice > 0 && !(l.supplierUnitCost && l.supplierUnitCost > 0))) reasons.push("líneas sin coste: no se puede verificar el margen");
  else if (cost <= 0 || ((net - cost) / cost) * 100 < MIN_AUTO_MARGIN_PCT) reasons.push(`margen por debajo del ${MIN_AUTO_MARGIN_PCT} %`);
  if (net > AUTOENVIO_MAX_NET_CENTS) reasons.push(`${(net / 100).toFixed(2)} € netos superan 300 €`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(q.customerEmail || "")) || /@whatsapp\.local$/i.test(String(q.customerEmail))) reasons.push("sin email del cliente");
  if (!i.consent) reasons.push("sin consentimiento del cliente");
  if (i.readingDoubt) reasons.push(`lectura dudosa: ${i.readingDoubt}`);
  if (i.otherLive) reasons.push(i.otherLive);
  if (i.guards.action === "skip") reasons.push(i.guards.reason);
  if (i.guards.action === "alert") reasons.push(...i.guards.reasons);
  return reasons.length ? { action: "hold", reasons: [...new Set(reasons)] } : { action: "send", channel: origin.channel };
}

export function autoenvioHourOk(madridHour: number): boolean {
  return madridHour >= AUTOENVIO_FROM_HOUR && madridHour < AUTOENVIO_UNTIL_HOUR;
}
