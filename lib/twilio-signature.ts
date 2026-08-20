// Utilidades puras del webhook de WhatsApp (sin Prisma ni Blob): testeables.
import { createHmac, timingSafeEqual } from "node:crypto";

/** Validación de firma de Twilio: X-Twilio-Signature = base64(HMAC-SHA1(url + params ordenados por clave)). */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string | undefined = process.env.TWILIO_AUTH_TOKEN
): boolean {
  if (!authToken || !signature) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url);
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** +34600123456 → "34600123456@whatsapp.local" (convenio de los clientes solo-WhatsApp). */
export function whatsappLocalEmail(phoneE164: string): string {
  return `${phoneE164.replace(/\D/g, "")}@whatsapp.local`;
}

export function phoneFromWhatsAppAddress(v: string): string {
  return v.replace(/^whatsapp:/i, "").trim();
}
