// lib/client-token.ts — Token de acceso del CLIENTE a su zona (magic-link por email).
// HMAC-SHA256 sobre el email (normalizado), con caducidad. Namespaced con el
// prefijo "client:" para que un token de pedido (lib/order-token) NUNCA valga
// como token de cliente y viceversa. Reusa ORDER_TOKEN_SECRET (misma clave,
// distinto dominio de mensaje).

import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.ORDER_TOKEN_SECRET || "";

function normalizeEmail(email: string): string {
  return String(email || "").trim().toLowerCase();
}

function hmacHex(message: string): string {
  return createHmac("sha256", SECRET).update(message).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 días

/** Genera `<expUnix>.<hmac>` para el email del cliente. Siempre con caducidad. */
export function generateClientToken(email: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): string {
  if (!SECRET) throw new Error("ORDER_TOKEN_SECRET is not set");
  const e = normalizeEmail(email);
  const exp = Math.floor(Date.now() / 1000) + Math.floor(ttlSeconds);
  return `${exp}.${hmacHex(`client:${e}|${exp}`)}`;
}

/** Verifica el token y devuelve el email normalizado si es válido, o null. */
export function verifyClientToken(email: string, token: string): boolean {
  if (!SECRET || !token) return false;
  const e = normalizeEmail(email);
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0) return false;
  const exp = Number(token.slice(0, dotIdx));
  const tokenHmac = token.slice(dotIdx + 1);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  if (Math.floor(Date.now() / 1000) > exp) return false;
  return safeEqualHex(hmacHex(`client:${e}|${exp}`), tokenHmac);
}

/** Construye la URL del portal con email + token firmado. */
export function buildClientPortalUrl(email: string, ttlSeconds?: number): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  const e = normalizeEmail(email);
  const token = generateClientToken(e, ttlSeconds);
  const params = new URLSearchParams({ email: e, token });
  return `${base}/area-cliente?${params.toString()}`;
}
