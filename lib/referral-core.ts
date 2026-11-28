// lib/referral-core.ts — Código de recomendación de UN solo uso (Juan, 28-nov-2026).
//
// · El invitado tiene un 10 % sobre la base sin IVA de su presupuesto.
// · El dueño gana un 10 % de un solo uso para su siguiente encargo SOLO cuando el
//   pedido del invitado queda PAGADO (markReferralEarnedForPaidOrder, enganchado en
//   lib/orders.updateOrderPayment, el punto común de Stripe, Redsys, PayPal y manual).
// · No se acumula con ningún otro descuento. Caduca a los 12 meses. Sin autouso.
// · SUELO («nunca puedo perder»): fuera del francés de Juan, la base descontada no
//   baja nunca de coste del jurado × 1,10; si choca se recorta y queda rastro; si el
//   coste no se conoce, NO se aplica.
//
// Sin alias @/ ni Prisma importado: el acceso a datos llega por parámetro (`db`,
// el cliente de Prisma o una transacción), así los tests corren con node --test.

import { computeQuoteTotals, round2, type QuoteDeliveryType, type QuoteDiscountType } from "./quote-math.ts";
import { isLooseApostilleLine } from "./pricing-engine/page-pricing.ts";
import { clientIdentityKeys, emailKey, isPlaceholderEmailKey, phoneKey } from "./client-identity.ts";

export const REFERRAL_PCT = 10;
export const REFERRAL_VALID_MONTHS = 12;
export const REFERRAL_FLOOR_MULTIPLIER = 1.1;
export const REFERRAL_SHARE_BASE = "https://www.traduccionesjuradas.net/";
// Sin 0/O, 1/I/L: se dictan por teléfono.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_RE = /^[A-Z]{2,10}-[A-HJKMNP-Z2-9]{4}$/;
const OPEN_QUOTE_STATUSES = ["SENT", "OPENED", "ACCEPTED"];

export type ReferralReason =
  | "FORMATO"
  | "NO_EXISTE"
  | "CADUCADO"
  | "YA_USADO"
  | "AUTOUSO"
  | "INVITADO_YA_USO"
  | "YA_TIENE_DESCUENTO"
  | "COSTE_DESCONOCIDO"
  | "SIN_MARGEN"
  | "NO_APLICABLE"
  | "SIN_CREDITO";

export const REFERRAL_REASON_TEXT: Record<ReferralReason, string> = {
  FORMATO: "El código no tiene el formato correcto (por ejemplo, MARIE-7K2Q).",
  NO_EXISTE: "No encontramos ese código. Revisa que esté bien escrito.",
  CADUCADO: "Este código ha caducado (son válidos 12 meses).",
  YA_USADO: "Este código ya se ha usado. Cada código sirve una sola vez.",
  AUTOUSO: "No puedes usar tu propio código de recomendación. Compártelo con quien lo necesite.",
  INVITADO_YA_USO: "Ya has usado un código de recomendación antes; solo se puede usar uno por cliente.",
  YA_TIENE_DESCUENTO: "Este presupuesto ya tiene un descuento y los descuentos no se acumulan.",
  COSTE_DESCONOCIDO: "No podemos aplicar el código a este presupuesto todavía. Escríbenos y lo revisamos.",
  SIN_MARGEN: "Este presupuesto ya tiene el precio mínimo y no admite más descuento.",
  NO_APLICABLE: "Este presupuesto ya no admite cambios (pagado, caducado o en revisión).",
  SIN_CREDITO: "No tienes ningún crédito por recomendación disponible.",
};

// ── Puro ────────────────────────────────────────────────────────────────────

const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;

export function normalizeCodeInput(raw: string | null | undefined): string | null {
  const s = String(raw || "").trim().toUpperCase().replace(/[\s_]+/g, "").replace(/[\u2010-\u2015]/g, "-");
  const withDash = /^[A-Z]{2,10}[A-Z2-9]{4}$/.test(s) && !s.includes("-") ? `${s.slice(0, -4)}-${s.slice(-4)}` : s;
  return CODE_RE.test(withDash) ? withDash : null;
}

export function codePrefixFromName(name: string | null | undefined, email?: string | null): string {
  const clean = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
  const first = clean(String(name || "").trim().split(/\s+/)[0] || "");
  const fromEmail = clean(String(email || "").split("@")[0].split(/[._+-]/)[0] || "");
  const p = (first.length >= 2 ? first : fromEmail.length >= 2 ? fromEmail : "AMIGO").slice(0, 10);
  return p;
}

export function generateReferralCode(name: string | null | undefined, email: string | null | undefined, rand: () => number = Math.random): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
  return `${codePrefixFromName(name, email)}-${suffix}`;
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}

export function shareUrlFor(code: string): string {
  return `${REFERRAL_SHARE_BASE}?ref=${encodeURIComponent(code)}`;
}

/** Línea de factura (base sin IVA) que deja a la vista el descuento por recomendación. */
export function referralInvoiceLines(input: { baseCents: number; discountCents: number; code: string; kind: "invitee" | "owner_credit" }) {
  if (!(input.discountCents > 0)) return null;
  const what = input.kind === "invitee" ? `código de recomendación ${input.code}` : `crédito por recomendar (${input.code})`;
  return [
    {
      description: "Traducción jurada",
      detail: `Precio ${eur(input.baseCents + input.discountCents)} − descuento por ${what} ${eur(input.discountCents)} = base imponible ${eur(input.baseCents)}`,
      amountCents: input.baseCents,
    },
  ];
}

export type DiscountLine = { quantity: number; unitPrice: number; supplierUnitCost?: number | null; description?: string | null };

export type ReferralDiscount =
  | { ok: true; discountCents: number; requestedCents: number; clamped: boolean; floorCents: number | null; costCents: number | null; note: string | null }
  | { ok: false; code: "COSTE_DESCONOCIDO" | "SIN_MARGEN"; detail: string };

const lineCents = (qty: number, unit: number | null | undefined) => Math.round((Number(qty) || 0) * (Number(unit) || 0) * 100);

/** Descuento sobre la base de las líneas (sin envío ni IVA), con el suelo del jurado. */
export function computeReferralDiscount(input: { lines: DiscountLine[]; isFrench: boolean; pct?: number }): ReferralDiscount {
  const pct = input.pct ?? REFERRAL_PCT;
  const baseCents = input.lines.reduce((a, l) => a + lineCents(l.quantity, l.unitPrice), 0);
  const requestedCents = Math.max(0, Math.round((baseCents * pct) / 100));
  if (requestedCents <= 0) return { ok: false, code: "SIN_MARGEN", detail: "presupuesto sin importe" };
  // Francés: lo traduce Juan, no hay coste de jurado que proteger.
  if (input.isFrench) return { ok: true, discountCents: requestedCents, requestedCents, clamped: false, floorCents: null, costCents: null, note: null };

  const sinCoste = input.lines.find(
    (l) => Number(l.unitPrice) > 0 && !(Number(l.supplierUnitCost) > 0) && !isLooseApostilleLine(Number(l.unitPrice), l.supplierUnitCost)
  );
  if (sinCoste) return { ok: false, code: "COSTE_DESCONOCIDO", detail: `línea sin coste del jurado: "${String(sinCoste.description || "").slice(0, 80)}"` };
  const costCents = input.lines.reduce((a, l) => a + lineCents(l.quantity, l.supplierUnitCost), 0);
  if (costCents <= 0) return { ok: false, code: "COSTE_DESCONOCIDO", detail: "sin coste del jurado en ninguna línea" };

  const floorCents = Math.ceil(costCents * REFERRAL_FLOOR_MULTIPLIER);
  const room = baseCents - floorCents;
  if (room <= 0) return { ok: false, code: "SIN_MARGEN", detail: `base ${eur(baseCents)} ≤ suelo ${eur(floorCents)} (coste ${eur(costCents)} × 1,10)` };
  const discountCents = Math.min(requestedCents, room);
  const clamped = discountCents < requestedCents;
  return {
    ok: true,
    discountCents,
    requestedCents,
    clamped,
    floorCents,
    costCents,
    note: clamped
      ? `Recortado al suelo: ${pct} % = ${eur(requestedCents)} → ${eur(discountCents)} (base ${eur(baseCents)}, coste ${eur(costCents)} × 1,10 = ${eur(floorCents)})`
      : null,
  };
}

export type Identity = { customerId?: string | null; email?: string | null; phone?: string | null };

/** ¿El invitado es el dueño? Por Customer, por email o por teléfono (y alias declarados). */
export function isSelfUse(owners: Identity[], invitee: Identity): boolean {
  const ownerIds = new Set(owners.map((o) => o.customerId).filter(Boolean));
  if (invitee.customerId && ownerIds.has(invitee.customerId)) return true;
  const ownerKeys = new Set(owners.flatMap((o) => clientIdentityKeys({ email: isPlaceholderEmailKey(o.email) ? null : o.email, phone: o.phone })));
  const inviteeKeys = clientIdentityKeys({ email: isPlaceholderEmailKey(invitee.email) ? null : invitee.email, phone: invitee.phone });
  return inviteeKeys.some((k) => ownerKeys.has(k));
}

export type QuoteForReferral = {
  id: string;
  status: string;
  customerId: string;
  customerEmail: string;
  customerPhone: string | null;
  sourceLang: string;
  targetLang: string;
  deliveryType: QuoteDeliveryType | string;
  shippingBase: unknown;
  vatRate: unknown;
  discountType: QuoteDiscountType | string;
  discountValue: unknown;
  discountAmount: unknown;
  total: unknown;
  paidAt: Date | null;
  validUntil: Date;
  sendingAt: Date | null;
  deletedAt: Date | null;
  supersededAt: Date | null;
  paymentFrozenAt: Date | null;
  balanceAmount: unknown;
  lines: Array<{ description: string; quantity: unknown; unitPrice: unknown; supplierUnitCost: unknown }>;
  orders: Array<{ id: string }>;
};

export function quoteBlocker(q: QuoteForReferral, now: Date): ReferralReason | null {
  if (!OPEN_QUOTE_STATUSES.includes(String(q.status))) return "NO_APLICABLE";
  if (q.paidAt || q.sendingAt || q.deletedAt || q.supersededAt || q.paymentFrozenAt) return "NO_APLICABLE";
  if (q.validUntil.getTime() <= now.getTime()) return "NO_APLICABLE";
  if (q.balanceAmount != null && Number(q.balanceAmount) > 0) return "NO_APLICABLE"; // pago en plazos: lo toca el staff
  if (q.orders.length > 0) return "NO_APLICABLE"; // el pedido ya guarda su importe: no se desincroniza
  if (String(q.discountType) !== "NONE" && (Number(q.discountValue) > 0 || Number(q.discountAmount) > 0)) return "YA_TIENE_DESCUENTO";
  if (Number(q.discountAmount) > 0) return "YA_TIENE_DESCUENTO";
  return null;
}

function isFrenchQuote(q: { sourceLang: string; targetLang: string }) {
  const p = `${String(q.sourceLang || "").toLowerCase()}-${String(q.targetLang || "").toLowerCase()}`;
  return p === "fr-es" || p === "es-fr";
}

/** Totales del presupuesto con un descuento FIXED en céntimos; null si el total actual no cuadra con las líneas. */
export function quoteTotalsWithDiscount(q: QuoteForReferral, discountCents: number) {
  const base = {
    lines: q.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
    vatRate: Number(q.vatRate),
    deliveryType: String(q.deliveryType) as QuoteDeliveryType,
    shippingBase: Number(q.shippingBase),
  };
  const before = computeQuoteTotals({ ...base, discountType: "NONE", discountValue: 0 });
  if (Math.abs(Math.round(before.total * 100) - Math.round(Number(q.total) * 100)) > 1) return null;
  const after = computeQuoteTotals({ ...base, discountType: "FIXED", discountValue: round2(discountCents / 100) });
  return { before, after };
}

// ── Con datos (db = prisma o transacción) ──────────────────────────────────

// Tipado laxo a propósito: el cliente real es Prisma y el de los tests, un doble en memoria.
export type ReferralDb = any;

export type ApplyResult =
  | { ok: true; code: string; discountCents: number; clamped: boolean; note: string | null; total: number; kind: "invitee" | "owner_credit" }
  | { ok: false; reason: ReferralReason; message: string; detail?: string };

const fail = (reason: ReferralReason, detail?: string): ApplyResult => ({ ok: false, reason, message: REFERRAL_REASON_TEXT[reason], detail });

class Abort extends Error {
  reason: ReferralReason;
  detail?: string;
  constructor(reason: ReferralReason, detail?: string) {
    super(reason);
    this.reason = reason;
    this.detail = detail;
  }
}

const QUOTE_SELECT = {
  id: true, status: true, customerId: true, customerEmail: true, customerPhone: true, sourceLang: true, targetLang: true,
  deliveryType: true, shippingBase: true, vatRate: true, discountType: true, discountValue: true, discountAmount: true, total: true,
  paidAt: true, validUntil: true, sendingAt: true, deletedAt: true, supersededAt: true, paymentFrozenAt: true, balanceAmount: true,
  lines: { select: { description: true, quantity: true, unitPrice: true, supplierUnitCost: true }, orderBy: { createdAt: "asc" } },
  orders: { select: { id: true } },
};

function isUniqueViolation(e: any) {
  return e?.code === "P2002";
}

/** Escribe el descuento en el presupuesto con update condicional: sin descuento previo y sin pagar. */
async function writeQuoteDiscount(tx: ReferralDb, q: QuoteForReferral, discountCents: number) {
  const totals = quoteTotalsWithDiscount(q, discountCents);
  if (!totals) throw new Abort("NO_APLICABLE", "el total guardado no cuadra con las líneas");
  const { after } = totals;
  const res = await tx.quote.updateMany({
    where: { id: q.id, paidAt: null, sendingAt: null, paymentFrozenAt: null, discountAmount: 0, status: { in: OPEN_QUOTE_STATUSES } },
    data: {
      discountType: "FIXED",
      discountValue: round2(discountCents / 100),
      subtotal: after.subtotal,
      discountAmount: after.discountAmount,
      shippingAmount: after.shippingAmount,
      vatAmount: after.vatAmount,
      total: after.total,
    },
  });
  if (res.count !== 1) throw new Abort("YA_TIENE_DESCUENTO", "el presupuesto cambió mientras se aplicaba");
  return after;
}

/** El invitado aplica un código a su presupuesto. Solo uno gana en una carrera. */
export async function applyReferralCodeToQuote(db: ReferralDb, input: { quoteId: string; code: string; now?: Date }): Promise<ApplyResult> {
  const now = input.now ?? new Date();
  const code = normalizeCodeInput(input.code);
  if (!code) return fail("FORMATO");
  try {
    return await db.$transaction(async (tx: ReferralDb) => {
      const q: QuoteForReferral | null = await tx.quote.findUnique({ where: { id: input.quoteId }, select: QUOTE_SELECT });
      if (!q) throw new Abort("NO_APLICABLE");
      const row = await tx.referralCode.findUnique({ where: { code } });
      if (!row) throw new Abort("NO_EXISTE");
      const owner = await tx.customer.findUnique({ where: { id: row.ownerCustomerId }, select: { id: true, email: true, phone: true } });
      const invitee: Identity = { customerId: q.customerId, email: q.customerEmail, phone: q.customerPhone };
      if (isSelfUse([{ customerId: row.ownerCustomerId, email: row.ownerEmail, phone: row.ownerPhone }, { customerId: owner?.id, email: owner?.email, phone: owner?.phone }], invitee)) {
        throw new Abort("AUTOUSO");
      }
      if (row.usedAt) throw new Abort("YA_USADO");
      if (new Date(row.expiresAt).getTime() <= now.getTime()) throw new Abort("CADUCADO");
      const blocker = quoteBlocker(q, now);
      if (blocker) throw new Abort(blocker);

      const ek = emailKey(q.customerEmail);
      const pk = phoneKey(q.customerPhone);
      const prior = await tx.referralCode.findFirst({
        where: { OR: [{ usedByCustomerId: q.customerId }, ...(ek && !isPlaceholderEmailKey(ek) ? [{ usedByEmail: ek }] : []), ...(pk ? [{ usedByPhone: pk }] : [])] },
        select: { id: true },
      });
      if (prior) throw new Abort("INVITADO_YA_USO");

      const d = computeReferralDiscount({
        lines: q.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), supplierUnitCost: l.supplierUnitCost == null ? null : Number(l.supplierUnitCost) })),
        isFrench: isFrenchQuote(q),
      });
      if (!d.ok) throw new Abort(d.code, d.detail);

      // Reclamo atómico: solo si sigue sin usar y sin caducar.
      const claim = await tx.referralCode.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
        data: {
          usedAt: now,
          usedByCustomerId: q.customerId,
          usedByEmail: ek && !isPlaceholderEmailKey(ek) ? ek : null,
          usedByPhone: pk || null,
          usedOnQuoteId: q.id,
          discountCents: d.discountCents,
          requestedDiscountCents: d.requestedCents,
          floorClamped: d.clamped,
          floorNote: d.note,
          rewardStatus: "PENDING",
        },
      });
      if (claim.count !== 1) throw new Abort("YA_USADO");
      const after = await writeQuoteDiscount(tx, q, d.discountCents);
      return { ok: true as const, code, discountCents: d.discountCents, clamped: d.clamped, note: d.note, total: after.total, kind: "invitee" as const };
    });
  } catch (e: any) {
    if (e instanceof Abort) return fail(e.reason, e.detail);
    if (isUniqueViolation(e)) {
      const target = String(e?.meta?.target || "");
      return fail(target.includes("usedByCustomerId") ? "INVITADO_YA_USO" : target.includes("usedOnQuoteId") ? "YA_TIENE_DESCUENTO" : "YA_USADO");
    }
    throw e;
  }
}

/** El dueño canjea su crédito ganado (el más antiguo) en su presupuesto. */
export async function redeemOwnerCreditOnQuote(db: ReferralDb, input: { quoteId: string; now?: Date }): Promise<ApplyResult> {
  const now = input.now ?? new Date();
  try {
    return await db.$transaction(async (tx: ReferralDb) => {
      const q: QuoteForReferral | null = await tx.quote.findUnique({ where: { id: input.quoteId }, select: QUOTE_SELECT });
      if (!q) throw new Abort("NO_APLICABLE");
      const credit = await tx.referralCode.findFirst({
        where: { ownerCustomerId: q.customerId, rewardStatus: "EARNED", rewardRedeemedOnQuoteId: null },
        orderBy: { rewardEarnedAt: "asc" },
      });
      if (!credit) throw new Abort("SIN_CREDITO");
      // El crédito no se gasta en el mismo encargo que lo generó.
      if (credit.usedOnQuoteId === q.id) throw new Abort("NO_APLICABLE");
      const blocker = quoteBlocker(q, now);
      if (blocker) throw new Abort(blocker);
      const d = computeReferralDiscount({
        lines: q.lines.map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), supplierUnitCost: l.supplierUnitCost == null ? null : Number(l.supplierUnitCost) })),
        isFrench: isFrenchQuote(q),
      });
      if (!d.ok) throw new Abort(d.code, d.detail);
      const claim = await tx.referralCode.updateMany({
        where: { id: credit.id, rewardStatus: "EARNED", rewardRedeemedOnQuoteId: null },
        data: { rewardStatus: "REDEEMED", rewardRedeemedOnQuoteId: q.id, rewardRedeemedAt: now, rewardDiscountCents: d.discountCents, floorNote: d.note ?? credit.floorNote },
      });
      if (claim.count !== 1) throw new Abort("SIN_CREDITO");
      const after = await writeQuoteDiscount(tx, q, d.discountCents);
      return { ok: true as const, code: credit.code, discountCents: d.discountCents, clamped: d.clamped, note: d.note, total: after.total, kind: "owner_credit" as const };
    });
  } catch (e: any) {
    if (e instanceof Abort) return fail(e.reason, e.detail);
    if (isUniqueViolation(e)) return fail("YA_TIENE_DESCUENTO");
    throw e;
  }
}

// Sin venta (o cobrado a otro precio): el código vuelve a estar libre y el dueño sin crédito.
const RELEASE_CODE = {
  usedAt: null, usedByCustomerId: null, usedByEmail: null, usedByPhone: null, usedOnQuoteId: null, usedOnOrderId: null,
  discountCents: null, requestedDiscountCents: null, floorClamped: false, floorNote: null, rewardStatus: "NONE",
};
// Crédito del dueño canjeado en un presupuesto sin venta: vuelve a estar disponible.
const UNREDEEM_CREDIT = { rewardStatus: "EARNED", rewardRedeemedOnQuoteId: null, rewardRedeemedAt: null, rewardDiscountCents: null };

function linkedRowsWhere(quoteId: string) {
  return { OR: [{ usedOnQuoteId: quoteId, rewardStatus: "PENDING" }, { rewardRedeemedOnQuoteId: quoteId, rewardStatus: "REDEEMED" }] };
}

function rowDiscountCents(row: any, quoteId: string): number {
  return Number(row.rewardRedeemedOnQuoteId === quoteId ? row.rewardDiscountCents : row.discountCents) || 0;
}

async function freeRow(tx: ReferralDb, row: any, quoteId: string): Promise<number> {
  const res =
    row.rewardRedeemedOnQuoteId === quoteId
      ? await tx.referralCode.updateMany({ where: { id: row.id, rewardRedeemedOnQuoteId: quoteId, rewardStatus: "REDEEMED" }, data: UNREDEEM_CREDIT })
      : await tx.referralCode.updateMany({ where: { id: row.id, usedOnQuoteId: quoteId, rewardStatus: "PENDING" }, data: RELEASE_CODE });
  return res.count;
}

/** Totales del presupuesto sin el descuento FIXED del código; null si su descuento no es ese. */
function undiscountedTotals(q: QuoteForReferral | null, discountCents: number) {
  if (!q || String(q.discountType) !== "FIXED" || Math.round(Number(q.discountValue) * 100) !== discountCents) return null;
  return computeQuoteTotals({
    lines: q.lines.map((l: any) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
    vatRate: Number(q.vatRate),
    deliveryType: String(q.deliveryType) as QuoteDeliveryType,
    shippingBase: Number(q.shippingBase),
    discountType: "NONE",
    discountValue: 0,
  });
}

/** Total (céntimos, IVA incl.) del presupuesto sin el descuento de recomendación que lleva; null si no lleva ninguno.
 *  El webhook acepta ese importe: es una sesión de pago abierta antes de aplicar el código. */
export async function referralUndiscountedTotalCents(db: ReferralDb, quoteId: string): Promise<number | null> {
  const rows = await db.referralCode.findMany({ where: linkedRowsWhere(quoteId) });
  if (rows.length !== 1) return null;
  const q = await db.quote.findUnique({ where: { id: quoteId }, select: QUOTE_SELECT });
  // Ya pagado: un segundo cobro al precio entero es un doble cobro, nunca un pago válido.
  if (!q || q.paidAt || q.status === "PAID") return null;
  const before = undiscountedTotals(q, rowDiscountCents(rows[0], quoteId));
  return before ? Math.round(before.total * 100) : null;
}

/** Quita del presupuesto el descuento FIXED que puso el código (y solo ese); devuelve el total sin descuento. */
async function stripQuoteDiscount(tx: ReferralDb, quoteId: string, discountCents: number, onlyIfTotalCents?: number): Promise<number | null> {
  const q = await tx.quote.findUnique({ where: { id: quoteId }, select: QUOTE_SELECT });
  const before = undiscountedTotals(q, discountCents);
  if (!before) return null;
  if (onlyIfTotalCents != null && Math.round(before.total * 100) !== onlyIfTotalCents) return null;
  const res = await tx.quote.updateMany({
    where: { id: quoteId, discountType: "FIXED", discountValue: round2(discountCents / 100) },
    data: {
      discountType: "NONE",
      discountValue: 0,
      subtotal: before.subtotal,
      discountAmount: before.discountAmount,
      shippingAmount: before.shippingAmount,
      vatAmount: before.vatAmount,
      total: before.total,
    },
  });
  return res.count === 1 ? before.total : null;
}

export type PaidReferralResult = {
  earned: number;
  // Cobrado un importe distinto del total vigente (sesión de pago abierta antes del código,
  // o el código entró mientras llegaba el pago): el descuento NO cuenta.
  mismatch: null | { codes: string[]; paidCents: number; quoteTotalCents: number; restoredTotalCents: number | null };
};

/** Pedido del invitado PAGADO → crédito del dueño EARNED. Llamar dentro de la transacción del pago.
 *  Con paidCents: si no cuadra con el total vigente, el código se libera (o el crédito vuelve
 *  al dueño) y, si se cobró el precio sin descuento, el presupuesto vuelve a ese precio. */
export async function markReferralEarnedForPaidOrder(
  tx: ReferralDb,
  input: { orderId: string; quoteId: string | null; paidCents?: number | null; now?: Date }
): Promise<PaidReferralResult> {
  const now = input.now ?? new Date();
  if (input.quoteId && input.paidCents != null) {
    const rows = await tx.referralCode.findMany({ where: linkedRowsWhere(input.quoteId) });
    if (rows.length > 0) {
      const q = await tx.quote.findUnique({ where: { id: input.quoteId }, select: { total: true } });
      const quoteTotalCents = Math.round(Number(q?.total) * 100);
      if (quoteTotalCents !== input.paidCents) {
        let restoredTotalCents: number | null = null;
        for (const row of rows) {
          const discountCents = rowDiscountCents(row, input.quoteId);
          if ((await freeRow(tx, row, input.quoteId)) !== 1) continue;
          // El presupuesto vuelve al precio sin descuento solo si es lo que de verdad se cobró.
          const full = await stripQuoteDiscount(tx, input.quoteId, discountCents, input.paidCents);
          if (full != null) restoredTotalCents = Math.round(full * 100);
        }
        return { earned: 0, mismatch: { codes: rows.map((r: any) => r.code), paidCents: input.paidCents, quoteTotalCents, restoredTotalCents } };
      }
    }
  }
  const where = input.quoteId
    ? { rewardStatus: "PENDING", usedOnQuoteId: input.quoteId }
    : { rewardStatus: "PENDING", usedOnOrderId: input.orderId };
  const res = await tx.referralCode.updateMany({ where, data: { rewardStatus: "EARNED", rewardEarnedAt: now, usedOnOrderId: input.orderId } });
  return { earned: res.count, mismatch: null };
}

const SUCCESSOR_STATUSES = ["DRAFT", ...OPEN_QUOTE_STATUSES];

export type DeadQuoteResult = { released: string[]; transferredTo: string | null; strippedTotal: number | null };

/** Presupuesto caducado, sustituido o borrado SIN pagarse: el código pasa a la versión nueva
 *  del caso si ya lleva el mismo descuento; si no, se libera (y el crédito vuelve al dueño). */
export async function releaseReferralOnDeadQuote(db: ReferralDb, input: { quoteId: string }): Promise<DeadQuoteResult> {
  return db.$transaction(async (tx: ReferralDb) => {
    const none: DeadQuoteResult = { released: [], transferredTo: null, strippedTotal: null };
    const q = await tx.quote.findUnique({
      where: { id: input.quoteId },
      select: {
        id: true, status: true, paidAt: true, deletedAt: true, supersededAt: true, expiredAt: true, casoId: true, sourceLang: true, targetLang: true,
        orders: { select: { id: true, paymentStatus: true } },
      },
    });
    if (!q || q.paidAt || q.orders.some((o: any) => o.paymentStatus === "PAID")) return none;
    if (!(q.deletedAt || q.supersededAt || q.expiredAt || String(q.status) === "EXPIRED")) return none;
    const rows = await tx.referralCode.findMany({ where: linkedRowsWhere(q.id) });
    if (rows.length === 0) return none;

    const out: DeadQuoteResult = { ...none, released: [] };
    for (const row of rows) {
      const cents = rowDiscountCents(row, q.id);
      const isCredit = row.rewardRedeemedOnQuoteId === q.id;
      const next = q.casoId
        ? await tx.quote.findFirst({
            where: {
              casoId: q.casoId, id: { not: q.id }, sourceLang: q.sourceLang, targetLang: q.targetLang,
              deletedAt: null, supersededAt: null, expiredAt: null, paidAt: null, status: { in: SUCCESSOR_STATUSES },
              discountType: "FIXED", discountValue: round2(cents / 100),
            },
            orderBy: { createdAt: "desc" },
            select: { id: true, sourceLang: true, targetLang: true, lines: QUOTE_SELECT.lines },
          })
        : null;
      // La versión nueva puede tener otras líneas u otro coste: el suelo se recalcula con las suyas.
      const fits = next
        ? (() => {
            const d = computeReferralDiscount({
              lines: next.lines.map((l: any) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), supplierUnitCost: l.supplierUnitCost == null ? null : Number(l.supplierUnitCost) })),
              isFrench: isFrenchQuote(next),
            });
            return d.ok && d.discountCents === cents;
          })()
        : false;
      const taken = next && fits
        ? await tx.referralCode.findFirst({ where: { OR: [{ usedOnQuoteId: next.id }, { rewardRedeemedOnQuoteId: next.id }] }, select: { id: true } })
        : null;
      if (next && fits && !taken) {
        const moved = await tx.referralCode.updateMany({
          where: isCredit ? { id: row.id, rewardRedeemedOnQuoteId: q.id, rewardStatus: "REDEEMED" } : { id: row.id, usedOnQuoteId: q.id, rewardStatus: "PENDING" },
          data: isCredit ? { rewardRedeemedOnQuoteId: next.id } : { usedOnQuoteId: next.id },
        });
        if (moved.count === 1) out.transferredTo = next.id;
      } else if ((await freeRow(tx, row, q.id)) === 1) {
        out.released.push(row.code);
      } else {
        continue;
      }
      // El presupuesto muerto no se queda con un descuento que ya no respalda ningún código.
      out.strippedTotal = (await stripQuoteDiscount(tx, q.id, cents)) ?? out.strippedTotal;
    }
    return out;
  });
}

/** Devolución, cancelación o exclusión del pedido del invitado → crédito VOID si no se ha canjeado. */
export async function voidReferralRewardForOrder(
  db: ReferralDb,
  input: { orderId: string; quoteId: string | null; reason: string; now?: Date }
): Promise<{ voided: number; alreadyRedeemed: string[] }> {
  const now = input.now ?? new Date();
  const match = [{ usedOnOrderId: input.orderId }, ...(input.quoteId ? [{ usedOnQuoteId: input.quoteId }] : [])];
  const res = await db.referralCode.updateMany({
    where: { OR: match, rewardStatus: { in: ["PENDING", "EARNED"] } },
    data: { rewardStatus: "VOID", rewardVoidedAt: now, rewardVoidReason: input.reason.slice(0, 300) },
  });
  const redeemed = await db.referralCode.findMany({ where: { OR: match, rewardStatus: "REDEEMED" }, select: { code: true } });
  return { voided: res.count, alreadyRedeemed: redeemed.map((r: { code: string }) => r.code) };
}

/** Código del cliente de este pedido entregado. Idempotente por pedido y un solo código vivo por cliente. */
export async function ensureReferralCodeForOrder(
  db: ReferralDb,
  input: { orderId: string; now?: Date; rand?: () => number }
): Promise<{ code: string; expiresAt: Date } | null> {
  const now = input.now ?? new Date();
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, status: true, paymentStatus: true, billingExcluded: true, clientEmail: true, clientName: true, clientPhone: true, quote: { select: { customerId: true } } },
  });
  if (!order || order.paymentStatus !== "PAID" || order.status === "CANCELLED" || order.billingExcluded) return null;
  const own = await db.referralCode.findUnique({ where: { sourceOrderId: order.id }, select: { code: true, expiresAt: true } });
  if (own) return own;

  let customer = order.quote?.customerId
    ? await db.customer.findUnique({ where: { id: order.quote.customerId }, select: { id: true, name: true, email: true, phone: true } })
    : null;
  if (!customer) {
    customer = await db.customer.findFirst({ where: { email: { equals: String(order.clientEmail || "").trim(), mode: "insensitive" } }, select: { id: true, name: true, email: true, phone: true } });
  }
  if (!customer) {
    if (!String(order.clientEmail || "").trim()) return null;
    customer = await db.customer.create({
      data: { name: order.clientName || order.clientEmail, email: String(order.clientEmail).trim(), phone: order.clientPhone || null },
      select: { id: true, name: true, email: true, phone: true },
    });
  }
  const live = await db.referralCode.findFirst({
    where: { ownerCustomerId: customer.id, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { code: true, expiresAt: true },
  });
  if (live) return live;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await db.referralCode.create({
        data: {
          code: generateReferralCode(order.clientName || customer.name, order.clientEmail || customer.email, input.rand),
          ownerCustomerId: customer.id,
          ownerEmail: emailKey(order.clientEmail || customer.email),
          ownerPhone: phoneKey(order.clientPhone || customer.phone) || null,
          sourceOrderId: order.id,
          expiresAt: addMonths(now, REFERRAL_VALID_MONTHS),
        },
        select: { code: true, expiresAt: true },
      });
    } catch (e: any) {
      if (!isUniqueViolation(e)) throw e;
      const again = await db.referralCode.findUnique({ where: { sourceOrderId: order.id }, select: { code: true, expiresAt: true } });
      if (again) return again; // carrera con otra emisión del mismo pedido
    }
  }
  throw new Error("[referral] no se pudo generar un código único");
}

export type FloorDropResult = { codes: string[]; floorCents: number; discountedBaseCents: number; restoredTotal: number | null };

/** El coste del jurado cambió con el código ya aplicado: si la base descontada queda por debajo de
 *  coste × 1,10, el descuento se retira (código libre, o crédito devuelto al dueño). Francés: sin suelo. */
export async function dropReferralDiscountBelowFloor(db: ReferralDb, input: { quoteId: string; realCostCents: number }): Promise<FloorDropResult | null> {
  return db.$transaction(async (tx: ReferralDb) => {
    const rows = await tx.referralCode.findMany({ where: linkedRowsWhere(input.quoteId) });
    if (rows.length === 0) return null;
    const q: QuoteForReferral | null = await tx.quote.findUnique({ where: { id: input.quoteId }, select: QUOTE_SELECT });
    if (!q || q.paidAt || isFrenchQuote(q)) return null;
    const lineBase = q.lines.reduce((a, l) => a + lineCents(Number(l.quantity), Number(l.unitPrice)), 0);
    const floorCents = Math.ceil(Math.max(0, input.realCostCents) * REFERRAL_FLOOR_MULTIPLIER);
    const discountedBaseCents = lineBase - Math.round(Number(q.discountAmount) * 100);
    if (discountedBaseCents >= floorCents) return null;
    const out: FloorDropResult = { codes: [], floorCents, discountedBaseCents, restoredTotal: null };
    for (const row of rows) {
      const discountCents = rowDiscountCents(row, q.id);
      if ((await freeRow(tx, row, q.id)) !== 1) continue;
      out.codes.push(row.code);
      out.restoredTotal = (await stripQuoteDiscount(tx, q.id, discountCents)) ?? out.restoredTotal;
    }
    return out.codes.length ? out : null;
  });
}
