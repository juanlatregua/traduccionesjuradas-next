import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.ORDER_TOKEN_SECRET || "";

if (!SECRET) {
  console.warn(
    "[order-token] ORDER_TOKEN_SECRET is not set — order URLs will be built without HMAC tokens and verification will reject all requests."
  );
}

type GenerateOptions = {
  /** Si se pasa, el token incluye exp y caduca tras ttlSeconds. Sin esto, token legacy sin caducidad. */
  ttlSeconds?: number;
};

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

/**
 * Genera un token HMAC-SHA256 para una referencia de pedido.
 *
 * - Sin options: token legacy `<hmac>` SIN caducidad (válido mientras el pedido exista).
 * - Con `ttlSeconds`: token nuevo `<expUnix>.<hmac>` que caduca tras N segundos.
 *
 * El verifier acepta ambos formatos. Default sigue siendo legacy para no
 * romper enlaces de emails ya enviados; usa ttlSeconds caller-by-caller
 * cuando convenga (p. ej. enlaces de pago temporales, reset flows).
 */
export function generateOrderToken(reference: string, options?: GenerateOptions): string {
  if (!SECRET) throw new Error("ORDER_TOKEN_SECRET is not set");
  const ttl = options?.ttlSeconds;
  if (typeof ttl === "number" && ttl > 0) {
    const exp = Math.floor(Date.now() / 1000) + Math.floor(ttl);
    return `${exp}.${hmacHex(`${reference}|${exp}`)}`;
  }
  return hmacHex(reference);
}

/**
 * Verifica que el token recibido sea válido para esa referencia.
 * Acepta tanto formato legacy `<hmac>` como nuevo `<exp>.<hmac>`.
 * Usa comparación en tiempo constante para evitar timing attacks.
 */
export function verifyOrderToken(reference: string, token: string): boolean {
  if (!SECRET) {
    console.error(
      "[order-token] verifyOrderToken called but ORDER_TOKEN_SECRET is missing — rejecting reference",
      reference
    );
    return false;
  }
  if (!token) return false;

  const dotIdx = token.indexOf(".");
  if (dotIdx > 0) {
    const expStr = token.slice(0, dotIdx);
    const tokenHmac = token.slice(dotIdx + 1);
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp <= 0) return false;
    if (Math.floor(Date.now() / 1000) > exp) return false;
    return safeEqualHex(hmacHex(`${reference}|${exp}`), tokenHmac);
  }

  return safeEqualHex(hmacHex(reference), token);
}

/**
 * Construye la URL pública de un pedido con token HMAC.
 * Si ORDER_TOKEN_SECRET no está configurado, omite el token y loguea —
 * cualquier acceso posterior a la URL será rechazado por verifyOrderToken.
 */
export function buildSignedOrderUrl(
  reference: string,
  path: "pagar" | "detalle" | "estado" = "pagar",
  extraParams?: Record<string, string>,
): string {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.traduccionesjuradas.net"
  ).replace(/\/$/, "");

  const targetPath =
    path === "estado"
      ? `/pedido/${encodeURIComponent(reference)}`
      : `/area-cliente/pedido/${encodeURIComponent(reference)}${path === "pagar" ? "/pagar" : ""}`;

  const url = new URL(targetPath, base);

  if (SECRET) {
    url.searchParams.set("token", generateOrderToken(reference));
  } else {
    console.error(
      "[order-token] buildSignedOrderUrl producing URL without token for reference",
      reference,
      "— set ORDER_TOKEN_SECRET in the environment to fix"
    );
  }

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}
