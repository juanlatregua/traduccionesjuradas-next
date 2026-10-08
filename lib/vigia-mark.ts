// Enlace firmado «Ya lo traté» / «Posponer 7 días» del vigía (email de las 8:00 y
// /zona-traductor/vigia). Mismo patrón que lib/lavori-onetap.ts: HMAC con
// ORDER_TOKEN_SECRET, caducidad y espacio de nombres propio («vigia-mark:»).
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_SECONDS = 14 * 24 * 60 * 60;
export type VigiaMarkAction = "t" | "p"; // t = tratado (+3 d), p = posponer 7 d

const hmacHex = (message: string) => createHmac("sha256", process.env.ORDER_TOKEN_SECRET || "").update(message).digest("hex");
const payload = (k: string, q: string, a: string, exp: number) => `vigia-mark:${k}|${q}|${a}|${exp}`;

export function generateVigiaMarkToken(k: string, q: string, a: VigiaMarkAction, ttlSeconds = TTL_SECONDS): string {
  if (!process.env.ORDER_TOKEN_SECRET) throw new Error("ORDER_TOKEN_SECRET is not set");
  const exp = Math.floor(Date.now() / 1000) + Math.floor(ttlSeconds);
  return `${exp}.${hmacHex(payload(k, q, a, exp))}`;
}

export function verifyVigiaMarkToken(k: string, q: string, a: string, token: string): boolean {
  if (!process.env.ORDER_TOKEN_SECRET || !k || !token) return false;
  const [expStr, sig] = String(token).split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000) || !/^[0-9a-f]{64}$/.test(sig || "")) return false;
  const given = Buffer.from(sig, "hex");
  const expected = Buffer.from(hmacHex(payload(k, q, a, exp)), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** URL de la marca, o null si no hay secreto (p. ej. el CLI en local): el email sale igual, sin botones. */
export function vigiaMarkUrl(k: string, quoteId: string | null | undefined, a: VigiaMarkAction): string | null {
  try {
    const q = quoteId || "";
    const base = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
    return `${base}/api/vigia/marca?k=${encodeURIComponent(k)}&q=${encodeURIComponent(q)}&a=${a}&t=${generateVigiaMarkToken(k, q, a)}`;
  } catch {
    return null;
  }
}
