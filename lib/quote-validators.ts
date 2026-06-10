import {
  DEFAULT_VAT_RATE,
  PAPER_SHIPPING_BASE_EUR,
  normalizeQuoteLines,
  type QuoteDeliveryType,
  type QuoteDiscountType,
} from "@/lib/quotes";

function normalizeDeliveryType(value: unknown): QuoteDeliveryType {
  return String(value || "").toUpperCase() === "PAPER_SHIP" ? "PAPER_SHIP" : "DIGITAL_PDF";
}

function normalizeDiscountType(value: unknown): QuoteDiscountType {
  const raw = String(value || "").toUpperCase();
  if (raw === "PERCENT" || raw === "FIXED") return raw;
  return "NONE";
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value: unknown) {
  const phone = String(value || "").trim();
  return phone || null;
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeNumber(value: unknown, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function validateEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type ParsedCommon = {
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  sourceLang: string;
  targetLang: string;
  deliveryType: QuoteDeliveryType;
  discountType: QuoteDiscountType;
  discountValue: number;
  vatRate: number;
  notesLegal: string | null;
  validityDays: number;
  marginPct: number | null;
  paymentMethods: string[];
  contactWhatsapp: string | null;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    supplierUnitCost?: number;
  }>;
};

const ALLOWED_PAYMENT_METHODS = ["bbva", "openbank", "bizum", "paypal"];

function normalizePaymentMethods(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const v of value) {
    const m = String(v || "").trim().toLowerCase();
    if (ALLOWED_PAYMENT_METHODS.includes(m)) seen.add(m);
  }
  return [...seen];
}

function parseCommon(raw: any): { ok: true; data: ParsedCommon } | { ok: false; error: string } {
  const customerName = normalizeText(raw.customerName);
  const customerEmail = normalizeEmail(raw.customerEmail);
  const sourceLang = normalizeText(raw.sourceLang).toLowerCase();
  const targetLang = normalizeText(raw.targetLang).toLowerCase();
  const deliveryType = normalizeDeliveryType(raw.deliveryType);
  const discountType = normalizeDiscountType(raw.discountType);
  const discountValue = normalizeNumber(raw.discountValue, 0);
  const vatRate = normalizeNumber(raw.vatRate, DEFAULT_VAT_RATE);
  const notesLegal = normalizeText(raw.notesLegal) || null;
  const validityDays = Math.max(1, Math.round(normalizeNumber(raw.validityDays, 15)));
  const customerPhone = normalizePhone(raw.customerPhone);
  const rawMargin = Number(raw.marginPct);
  const marginPct = Number.isFinite(rawMargin) && rawMargin >= 0 ? Math.round(rawMargin) : null;
  const paymentMethods = normalizePaymentMethods(raw.paymentMethods);
  const contactWhatsapp = normalizeText(raw.contactWhatsapp) || null;

  if (!customerName) return { ok: false, error: "Nombre de cliente requerido." };
  if (!validateEmail(customerEmail)) return { ok: false, error: "Email de cliente no válido." };
  if (!sourceLang || sourceLang.length < 2) return { ok: false, error: "Idioma origen requerido." };
  if (!targetLang || targetLang.length < 2) return { ok: false, error: "Idioma destino requerido." };
  if (vatRate < 0 || vatRate > 1) return { ok: false, error: "IVA inválido. Usa valor entre 0 y 1 (ej. 0.21)." };
  if (discountType === "PERCENT" && (discountValue < 0 || discountValue > 100)) {
    return { ok: false, error: "Descuento porcentual inválido (0-100)." };
  }
  if (discountType === "FIXED" && discountValue < 0) {
    return { ok: false, error: "Descuento fijo inválido." };
  }

  const parsedLines = normalizeQuoteLines(raw.lines);
  if (!parsedLines.ok) return parsedLines;

  return {
    ok: true,
    data: {
      customerName,
      customerEmail,
      customerPhone,
      sourceLang,
      targetLang,
      deliveryType,
      discountType,
      discountValue,
      vatRate,
      notesLegal,
      validityDays,
      marginPct,
      paymentMethods,
      contactWhatsapp,
      lines: parsedLines.lines,
    },
  };
}

export function parseCreateQuoteInput(raw: any) {
  const common = parseCommon(raw);
  if (!common.ok) return common;

  const shippingBase =
    common.data.deliveryType === "PAPER_SHIP"
      ? Math.max(0, normalizeNumber(raw.shippingBase, PAPER_SHIPPING_BASE_EUR))
      : 0;

  return {
    ok: true as const,
    data: {
      ...common.data,
      shippingBase,
    },
  };
}

export function parseUpdateQuoteInput(raw: any) {
  return parseCreateQuoteInput(raw);
}
