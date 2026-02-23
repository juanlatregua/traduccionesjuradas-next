import crypto from "crypto";

export type QuoteLineInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type QuoteDiscountType = "NONE" | "PERCENT" | "FIXED";
export type QuoteDeliveryType = "DIGITAL_PDF" | "PAPER_SHIP";
export type QuoteStatus =
  | "DRAFT"
  | "SENT"
  | "OPENED"
  | "ACCEPTED"
  | "PAID"
  | "IN_PROGRESS"
  | "DELIVERED"
  | "EXPIRED";

export const PAPER_SHIPPING_BASE_EUR = 12;
export const DEFAULT_VAT_RATE = 0.21;

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

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
    lines.push({
      description,
      quantity: round2(quantity),
      unitPrice: round2(unitPrice),
    });
  }

  return { ok: true as const, lines };
}

export function computeQuoteTotals(params: {
  lines: QuoteLineInput[];
  discountType: QuoteDiscountType;
  discountValue: number;
  vatRate: number;
  deliveryType: QuoteDeliveryType;
  shippingBase?: number;
}) {
  const safeVatRate = Number.isFinite(params.vatRate) ? Math.max(0, params.vatRate) : DEFAULT_VAT_RATE;
  const shippingBase = Number.isFinite(Number(params.shippingBase))
    ? Math.max(0, Number(params.shippingBase))
    : PAPER_SHIPPING_BASE_EUR;

  const lines = params.lines.map((line) => {
    const lineTotal = round2(line.quantity * line.unitPrice);
    return {
      description: line.description,
      quantity: round2(line.quantity),
      unitPrice: round2(line.unitPrice),
      lineTotal,
    };
  });

  const subtotal = round2(lines.reduce((acc, line) => acc + line.lineTotal, 0));
  const shippingAmount = params.deliveryType === "PAPER_SHIP" ? round2(shippingBase) : 0;

  let discountAmount = 0;
  if (params.discountType === "PERCENT") {
    const pct = Math.max(0, Number(params.discountValue || 0));
    discountAmount = round2(subtotal * (pct / 100));
  } else if (params.discountType === "FIXED") {
    discountAmount = round2(Math.max(0, Number(params.discountValue || 0)));
  }

  const maxDiscount = subtotal + shippingAmount;
  discountAmount = Math.min(discountAmount, maxDiscount);

  const taxableBase = round2(Math.max(0, subtotal + shippingAmount - discountAmount));
  const vatAmount = round2(taxableBase * safeVatRate);
  const total = round2(taxableBase + vatAmount);

  return {
    lines,
    subtotal,
    discountAmount,
    shippingAmount,
    vatAmount,
    total,
    vatRate: safeVatRate,
  };
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
