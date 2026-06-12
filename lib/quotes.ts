import crypto from "crypto";
import {
  round2,
  DEFAULT_VAT_RATE,
  type QuoteLineInput,
  type QuoteDeliveryType,
} from "./quote-math.ts";

// La matemática pura de totales vive en ./quote-math (client-safe, sin crypto):
// la importa también el builder para el resumen en vivo. Se re-exporta aquí para
// no romper los imports existentes desde "@/lib/quotes". Extensión .ts explícita
// para que el runner de tests (node --strip-types) resuelva el módulo.
export {
  computeQuoteTotals,
  round2,
  PAPER_SHIPPING_BASE_EUR,
  DEFAULT_VAT_RATE,
} from "./quote-math.ts";
export type {
  QuoteLineInput,
  QuoteDiscountType,
  QuoteDeliveryType,
} from "./quote-math.ts";
export type QuoteStatus =
  | "DRAFT"
  | "SENT"
  | "OPENED"
  | "ACCEPTED"
  | "PAID"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "EXPIRED";

// Margen de HBTJ sobre el coste del colaborador (decisión Juan 2026-06-08).
export const DEFAULT_COLLABORATOR_MARGIN_PCT = 25;

/**
 * Precio final al cliente a partir del coste (sin IVA) que cotiza el colaborador.
 * Aplica el margen de HBTJ y luego el IVA: coste × (1 + margen) × (1 + IVA).
 */
export function customerPriceFromSupplierCost(
  supplierCostCents: number,
  marginPct: number = DEFAULT_COLLABORATOR_MARGIN_PCT,
  vatRate: number = DEFAULT_VAT_RATE
) {
  const cost = Math.max(0, Math.round(Number(supplierCostCents) || 0));
  const safeMargin = Number.isFinite(marginPct) ? Math.max(0, marginPct) : DEFAULT_COLLABORATOR_MARGIN_PCT;
  const safeVat = Number.isFinite(vatRate) ? Math.max(0, vatRate) : DEFAULT_VAT_RATE;
  const withMargin = cost * (1 + safeMargin / 100);
  return Math.round(withMargin * (1 + safeVat));
}

/** Importe neto (sin IVA) a partir de un importe bruto con IVA incluido. */
export function netFromGross(grossCents: number, vatRate: number = DEFAULT_VAT_RATE) {
  const gross = Math.max(0, Math.round(Number(grossCents) || 0));
  const safeVat = Number.isFinite(vatRate) ? Math.max(0, vatRate) : DEFAULT_VAT_RATE;
  return Math.round(gross / (1 + safeVat));
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado",
  OPENED: "Abierto",
  ACCEPTED: "Aceptado",
  PAID: "Pagado",
  IN_PROGRESS: "En progreso",
  DELIVERED: "Entregado",
  EXPIRED: "Expirado",
};

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT", "EXPIRED"],
  SENT: ["OPENED", "ACCEPTED", "PAID", "EXPIRED"],
  OPENED: ["ACCEPTED", "PAID", "EXPIRED"],
  ACCEPTED: ["PAID", "EXPIRED"],
  PAID: ["IN_PROGRESS", "DELIVERED"],
  IN_PROGRESS: ["DELIVERED"],
  DELIVERED: [],
  EXPIRED: [],
};

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus) {
  return QUOTE_TRANSITIONS[from].includes(to);
}

export function isQuotePayableStatus(status: QuoteStatus) {
  return status === "SENT" || status === "OPENED" || status === "ACCEPTED";
}

export function isQuoteClosedStatus(status: QuoteStatus) {
  return status === "DELIVERED" || status === "EXPIRED";
}

export function decimalToNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number((value as { toString: () => string }).toString());
  }
  return Number(value || 0);
}

export function numberToMoneyString(value: number) {
  return round2(value).toFixed(2);
}

export function moneyToCents(value: number) {
  return Math.max(0, Math.round(round2(value) * 100));
}

export function centsToMoney(cents: number) {
  return round2((Number(cents) || 0) / 100);
}

export function normalizeQuoteLines(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false as const, error: "Debes incluir al menos una línea de presupuesto." };
  }

  const lines: QuoteLineInput[] = [];
  for (const item of raw) {
    const description = String((item as any)?.description || "").trim();
    const quantity = Number((item as any)?.quantity);
    const unitPrice = Number((item as any)?.unitPrice);
    if (!description) {
      return { ok: false as const, error: "Cada línea necesita descripción." };
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { ok: false as const, error: `Cantidad inválida en "${description}".` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { ok: false as const, error: `Precio inválido en "${description}".` };
    }
    const rawCost = Number((item as any)?.supplierUnitCost);
    const supplierUnitCost = Number.isFinite(rawCost) && rawCost >= 0 ? round2(rawCost) : undefined;
    lines.push({
      description,
      quantity: round2(quantity),
      unitPrice: round2(unitPrice),
      ...(supplierUnitCost !== undefined ? { supplierUnitCost } : {}),
    });
  }

  return { ok: true as const, lines };
}

export function addBusinessDays(from: Date, days: number) {
  const date = new Date(from);
  let remaining = Math.max(0, Math.round(days));
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return date;
}

export function calculateEtaDate(params: { from?: Date; deliveryType: QuoteDeliveryType }) {
  const start = params.from ? new Date(params.from) : new Date();
  const leadDays = params.deliveryType === "PAPER_SHIP" ? 3 : 2;
  return addBusinessDays(start, leadDays);
}

export function calculateValidUntil(issuedAt: Date, validityDays: number) {
  const days = Number.isFinite(validityDays) ? Math.max(1, Math.round(validityDays)) : 15;
  const result = new Date(issuedAt);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDateEs(input: Date | string) {
  const date = input instanceof Date ? input : new Date(input);
  if (isNaN(date.getTime())) return String(input);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function generateQuoteToken(size = 36) {
  return crypto.randomBytes(size).toString("base64url");
}

export function hashValue(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function generateQuoteNumber(nextCount: number, at = new Date()) {
  const year = at.getFullYear();
  const seq = String(Math.max(1, nextCount)).padStart(5, "0");
  return `${year}-${seq}`;
}

export function normalizeQuoteStatus(value: unknown): QuoteStatus {
  const raw = String(value || "").trim().toUpperCase();
  const all: QuoteStatus[] = ["DRAFT", "SENT", "OPENED", "ACCEPTED", "PAID", "IN_PROGRESS", "DELIVERED", "EXPIRED"];
  return all.includes(raw as QuoteStatus) ? (raw as QuoteStatus) : "DRAFT";
}

// === Fase 2: cotización competitiva multi-colaborador ===

// Idiomas excluidos del flujo de cotización competitiva (regla de negocio).
export const QUOTE_EXCLUDED_LANGS = new Set(["uk"]);

// Idioma francés → asignación directa a Juan Silva (no se saca a concurso).
const FRENCH_LANGS = new Set(["fr"]);

// Extrae el idioma origen de un par ("en-es" → "en", "fr → es" → "fr").
export function getSourceLang(langPair?: string | null): string | null {
  const normalized = String(langPair || "").trim().toLowerCase();
  if (!normalized) return null;
  const separators = ["→", "->", "-", "–", ">"];
  for (const sep of separators) {
    if (normalized.includes(sep)) {
      const part = normalized.split(sep)[0].trim();
      if (part.length >= 2 && part.length <= 3) return part;
    }
  }
  if (normalized.length >= 2 && normalized.length <= 3) return normalized;
  return null;
}

export function isQuoteExcludedLang(lang?: string | null): boolean {
  const normalized = String(lang || "").trim().toLowerCase();
  return QUOTE_EXCLUDED_LANGS.has(normalized);
}

export function isFrenchSourceLang(lang?: string | null): boolean {
  const normalized = String(lang || "").trim().toLowerCase();
  return FRENCH_LANGS.has(normalized);
}

export type SuggestedBidInput = {
  id: string;
  status: string;
  quotedPriceCents: number | null;
  quotedDeadline: Date | string | null;
};

// Sugiere la mejor oferta entre las QUOTED: menor precio, luego menor plazo.
// Devuelve el id sugerido o null si no hay ofertas válidas.
export function pickSuggestedBid(assignments: SuggestedBidInput[]): string | null {
  const candidates = assignments
    .filter((a) => a.status === "QUOTED" && typeof a.quotedPriceCents === "number" && a.quotedPriceCents > 0)
    .sort((a, b) => {
      const priceDiff = (a.quotedPriceCents as number) - (b.quotedPriceCents as number);
      if (priceDiff !== 0) return priceDiff;
      const aDeadline = a.quotedDeadline ? new Date(a.quotedDeadline).getTime() : Number.POSITIVE_INFINITY;
      const bDeadline = b.quotedDeadline ? new Date(b.quotedDeadline).getTime() : Number.POSITIVE_INFINITY;
      return aDeadline - bDeadline;
    });
  return candidates.length > 0 ? candidates[0].id : null;
}
