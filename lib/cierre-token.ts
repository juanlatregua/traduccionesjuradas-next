// Enlace firmado «Revisar y enviar» del aviso a staff (email + SMS) cuando el
// presupuesto no puede salir solo al llegar el precio del jurado. Mismo patrón
// que lib/lavori-onetap.ts: HMAC con ORDER_TOKEN_SECRET, caducidad y espacio de
// nombres propio («cierre-revisar:»). Abre el presupuesto (borrador ya montado).
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 7 * 24 * 60 * 60;
const hmacHex = (message: string) => createHmac("sha256", process.env.ORDER_TOKEN_SECRET || "").update(message).digest("hex");
// purpose «revisar» (abrir el borrador) o «motivo-<RAZÓN>» (fijar el motivo de pérdida con un clic).
const payload = (quoteId: string, exp: number, purpose: string) => `cierre-${purpose}:${quoteId}|${exp}`;

export function generateCierreToken(quoteId: string, ttlSeconds = TTL_SECONDS, purpose = "revisar"): string {
  if (!process.env.ORDER_TOKEN_SECRET) throw new Error("ORDER_TOKEN_SECRET is not set");
  const exp = Math.floor(Date.now() / 1000) + Math.floor(ttlSeconds);
  return `${exp}.${hmacHex(payload(quoteId, exp, purpose))}`;
}

export function verifyCierreToken(quoteId: string, token: string, purpose = "revisar"): boolean {
  if (!process.env.ORDER_TOKEN_SECRET || !quoteId || !token) return false;
  const [expStr, sig] = String(token).split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000) || !/^[0-9a-f]{64}$/.test(sig || "")) return false;
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(hmacHex(payload(quoteId, exp, purpose)), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** URL de un toque, o el enlace directo al presupuesto si no hay secreto (p. ej. local). */
export function cierreReviewUrl(quoteId: string): string {
  const base = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  try {
    return `${base}/api/cierre/revisar?q=${encodeURIComponent(quoteId)}&t=${generateCierreToken(quoteId)}`;
  } catch {
    return `${base}/zona-traductor/presupuestos/${quoteId}`;
  }
}

/** Enlace de un clic «motivo de pérdida» (GET confirma, POST escribe): /api/cierre/motivo. */
export function cierreLostReasonUrl(quoteId: string, reason: string): string | null {
  try {
    const base = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
    return `${base}/api/cierre/motivo?q=${encodeURIComponent(quoteId)}&r=${encodeURIComponent(reason)}&t=${generateCierreToken(quoteId, 14 * 24 * 60 * 60, `motivo-${reason}`)}`;
  } catch {
    return null;
  }
}
