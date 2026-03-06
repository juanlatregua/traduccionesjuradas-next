import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.ORDER_TOKEN_SECRET || "";

/**
 * Genera un token HMAC-SHA256 para una referencia de pedido.
 * El token NO caduca (válido mientras el pedido exista).
 */
export function generateOrderToken(reference: string): string {
  if (!SECRET) throw new Error("ORDER_TOKEN_SECRET is not set");
  return createHmac("sha256", SECRET).update(reference).digest("hex");
}

/**
 * Verifica que el token recibido sea válido para esa referencia.
 * Usa comparación en tiempo constante para evitar timing attacks.
 */
export function verifyOrderToken(reference: string, token: string): boolean {
  if (!SECRET) return false;
  const expected = generateOrderToken(reference);
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(token, "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * Construye la URL pública de un pedido con token HMAC.
 * Si ORDER_TOKEN_SECRET no está configurado, omite el token (backwards compat).
 */
export function buildSignedOrderUrl(
  reference: string,
  path: "pagar" | "detalle" = "pagar",
  extraParams?: Record<string, string>,
): string {
  const base = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.traduccionesjuradas.net"
  ).replace(/\/$/, "");

  const suffix = path === "pagar" ? "/pagar" : "";
  const url = new URL(
    `/area-cliente/pedido/${encodeURIComponent(reference)}${suffix}`,
    base,
  );

  if (SECRET) {
    url.searchParams.set("token", generateOrderToken(reference));
  }

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}
