// Enlace firmado "de un toque" del aviso a staff: dispara la solicitud de precio a
// lavori para un lead de la puerta sin abrir el builder (orden de Juan 25-ago-2026:
// «debería crear un carril y un aviso directo»). HMAC sobre el sessionToken de la
// puerta, con caducidad; namespaced ("lavori-lead:") para que nunca valga como
// token de cliente ni de pedido. Reusa ORDER_TOKEN_SECRET.
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.ORDER_TOKEN_SECRET || "";
const TTL_SECONDS = 7 * 24 * 60 * 60; // una semana: el lead caduca antes

function hmacHex(message: string): string {
  return createHmac("sha256", SECRET).update(message).digest("hex");
}

export function generateLavoriOneTapToken(sessionToken: string, ttlSeconds = TTL_SECONDS): string {
  if (!SECRET) throw new Error("ORDER_TOKEN_SECRET is not set");
  const exp = Math.floor(Date.now() / 1000) + Math.floor(ttlSeconds);
  return `${exp}.${hmacHex(`lavori-lead:${sessionToken}|${exp}`)}`;
}

export function verifyLavoriOneTapToken(sessionToken: string, token: string): boolean {
  if (!SECRET || !sessionToken || !token) return false;
  const [expStr, sig] = String(token).split(".");
  const exp = Number(expStr);
  // Longitud exacta: Buffer.from(hex) descarta un nibble sobrante y un token con
  // basura al final pasaría el timingSafeEqual (lo cazó el test unitario).
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000) || !/^[0-9a-f]{64}$/.test(sig || "")) return false;
  const expected = hmacHex(`lavori-lead:${sessionToken}|${exp}`);
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function lavoriOneTapUrl(sessionToken: string): string {
  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  return `${baseUrl}/api/lavori/one-tap?s=${encodeURIComponent(sessionToken)}&t=${generateLavoriOneTapToken(sessionToken)}`;
}
