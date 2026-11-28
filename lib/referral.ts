// lib/referral.ts — Código de recomendación con Prisma. Reglas y aritmética en
// lib/referral-core.ts (testable); aquí solo el cableado y los efectos.

import { prisma } from "@/lib/prisma";
import {
  applyReferralCodeToQuote,
  ensureReferralCodeForOrder,
  redeemOwnerCreditOnQuote,
  releaseReferralOnDeadQuote,
  shareUrlFor,
  voidReferralRewardForOrder,
  type ApplyResult,
} from "@/lib/referral-core";

export { markReferralEarnedForPaidOrder, normalizeCodeInput, REFERRAL_REASON_TEXT, REFERRAL_PCT } from "@/lib/referral-core";

export const REFERRAL_COOKIE = "tj_ref";

/** Para el email de entrega: emite (idempotente) y devuelve el código del cliente. */
export async function getReferralForDeliveryEmail(orderId: string): Promise<{ code: string; shareUrl: string } | null> {
  try {
    const r = await ensureReferralCodeForOrder(prisma, { orderId });
    return r ? { code: r.code, shareUrl: shareUrlFor(r.code) } : null;
  } catch (e) {
    console.error("[referral] emisión falló", orderId, e);
    return null;
  }
}

export async function issueReferralForOrder(orderId: string) {
  return getReferralForDeliveryEmail(orderId);
}

async function afterQuoteDiscount(quoteId: string, result: ApplyResult) {
  if (!result.ok) return;
  if (result.clamped) console.warn(`[referral] ${result.code} recortado al suelo en presupuesto ${quoteId}: ${result.note}`);
  await expireSessionsAfterPriceChange(quoteId);
  // El PDF de /q enseñaba el total viejo: se regenera (best-effort, el total vivo ya es el bueno).
  try {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { lines: { orderBy: { createdAt: "asc" } } } });
    if (!quote) return;
    const { buildAndUploadFinalQuotePdf } = await import("@/lib/quote-send");
    const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
    const pdf = await buildAndUploadFinalQuotePdf(quote, `${baseUrl}/q/${quote.publicToken}`);
    await prisma.quote.update({ where: { id: quote.id }, data: { pdfUrl: pdf.pdfUrl, pdfHash: pdf.pdfHash } });
  } catch (e) {
    console.error("[referral] PDF no regenerado", quoteId, e);
  }
}

// El total cambió: una sesión de Stripe abierta antes cobraría el precio viejo. /q solo
// cobra con tarjeta (Stripe), transferencia o crédito; Redsys/PayPal no pagan presupuestos.
async function expireSessionsAfterPriceChange(quoteId: string) {
  const { expireOpenStripeSessions } = await import("@/lib/precio-tras-envio");
  const r = await expireOpenStripeSessions(quoteId);
  if (r.error) console.error(`[referral] sesiones de Stripe de ${quoteId} sin revisar: ${r.error} (el cobro con importe viejo no se lleva el descuento)`);
}

/** Presupuesto caducado, sustituido o borrado sin pagar: el código pasa a la versión nueva o se libera. Nunca lanza. */
export async function releaseReferralForQuote(quoteId: string, reason: string): Promise<void> {
  try {
    const r = await releaseReferralOnDeadQuote(prisma, { quoteId });
    if (r.released.length) console.info(`[referral] ${reason}: código ${r.released.join(", ")} liberado (presupuesto ${quoteId} sin venta)`);
    if (r.transferredTo) console.info(`[referral] ${reason}: código pasado de ${quoteId} a ${r.transferredTo}`);
    if (r.strippedTotal != null) await expireSessionsAfterPriceChange(quoteId);
  } catch (e) {
    console.error("[referral] liberar código falló", quoteId, e);
  }
}

export async function applyReferralToQuote(quoteId: string, code: string): Promise<ApplyResult> {
  const result = await applyReferralCodeToQuote(prisma, { quoteId, code });
  await afterQuoteDiscount(quoteId, result);
  return result;
}

export async function redeemReferralCreditOnQuote(quoteId: string): Promise<ApplyResult> {
  const result = await redeemOwnerCreditOnQuote(prisma, { quoteId });
  await afterQuoteDiscount(quoteId, result);
  return result;
}

/** Crédito por recomendar disponible para este cliente (para ofrecerlo en /q). */
export async function hasReferralCredit(customerId: string): Promise<boolean> {
  const n = await prisma.referralCode.count({ where: { ownerCustomerId: customerId, rewardStatus: "EARNED", rewardRedeemedOnQuoteId: null } });
  return n > 0;
}

/** Pedido del invitado anulado (devolución, exclusión, borrado): VOID y aviso si ya se canjeó. */
export async function voidReferralForOrder(orderId: string, reason: string) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, reference: true, quoteId: true } });
    if (!order) return;
    const r = await voidReferralRewardForOrder(prisma, { orderId: order.id, quoteId: order.quoteId, reason });
    if (r.voided > 0 || r.alreadyRedeemed.length > 0) {
      await prisma.orderEvent
        .create({
          data: {
            orderId: order.id,
            type: "referral.reward_voided",
            message: r.alreadyRedeemed.length
              ? `Recomendación: el crédito del dueño (${r.alreadyRedeemed.join(", ")}) YA se había canjeado; revisar a mano.`
              : `Recomendación: crédito del dueño anulado (${reason}).`,
            payload: { reason, voided: r.voided, alreadyRedeemed: r.alreadyRedeemed },
          },
        })
        .catch((e) => console.error("[referral] rastro de anulación falló", e));
    }
  } catch (e) {
    console.error("[referral] anulación falló", orderId, e);
  }
}

/** Ficha del pedido (staff): el código emitido por este pedido y el usado en él. */
export async function getReferralStaffView(order: { id: string; quoteId: string | null }) {
  const [issued, used] = await Promise.all([
    prisma.referralCode.findUnique({ where: { sourceOrderId: order.id } }),
    prisma.referralCode.findFirst({
      where: { OR: [{ usedOnOrderId: order.id }, ...(order.quoteId ? [{ usedOnQuoteId: order.quoteId }, { rewardRedeemedOnQuoteId: order.quoteId }] : [])] },
    }),
  ]);
  return { issued, used };
}
