import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.ORDER_TOKEN_SECRET || "";

if (!SECRET) {
  console.warn(
    "[order-token] ORDER_TOKEN_SECRET is not set — order URLs will be built without HMAC tokens and verification will reject all requests."
  );
}

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
  if (!SECRET) {
    console.error(
      "[order-token] verifyOrderToken called but ORDER_TOKEN_SECRET is missing — rejecting reference",
      reference
    );
    return false;
  }
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
