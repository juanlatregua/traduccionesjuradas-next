// lib/contact.ts

const WHATSAPP_NUMBER = "34951333614"; // sin el + aquí
export const WHATSAPP_E164 = `+${WHATSAPP_NUMBER}`;
export const WHATSAPP_LOCAL = "951333614";
export const WHATSAPP_DISPLAY = "+34 951 333 614";

export const SITE_BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.traduccionesjuradas.net"
).replace(/\/$/, "");

function withTracking(path: string, params?: Record<string, string | null | undefined>) {
  const url = new URL(path, SITE_BASE_URL);
  const merged: Record<string, string> = {
    src: "wa",
    ...(params
      ? Object.fromEntries(
          Object.entries(params)
            .filter((entry): entry is [string, string] => Boolean(entry[1]))
            .map(([key, value]) => [key, String(value)])
        )
      : {}),
  };
  for (const [key, value] of Object.entries(merged)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function getTrackedPresupuestoUrl(agent = "whatsapp") {
  return withTracking("/presupuesto", { agent });
}

export function getTrackedConsultaUrl(reference?: string | null, agent = "whatsapp") {
  return withTracking("/consulta", {
    agent,
    ...(reference ? { ref: reference } : {}),
  });
}

export function getTrackedPaymentUrl(reference: string, agent = "whatsapp") {
  return withTracking(`/area-cliente/pedido/${reference}/pagar`, { agent, ref: reference });
}

export function getWhatsAppNumber() {
  return WHATSAPP_NUMBER;
}

export function buildWhatsAppLinkFromText(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

const WHATSAPP_MESSAGE =
  "Hola, quiero pedir un presupuesto de traduccion jurada. Idioma origen: / Idioma destino: / Tipo de documento: / Email de contacto:";

export const WHATSAPP_LINK = buildWhatsAppLinkFromText(WHATSAPP_MESSAGE);

export const EMAIL = "hola@traduccionesjuradas.net";
const SUBJECT = "Presupuesto traducción jurada";

export const MAIL_LINK = `mailto:${EMAIL}?subject=${encodeURIComponent(
  SUBJECT
)}`;
