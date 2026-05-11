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
  return withTracking("/presupuesto-instantaneo", { agent });
}

export function getTrackedConsultaUrl(reference?: string | null, agent = "whatsapp") {
  return withTracking(
    reference ? `/area-cliente/pedido/${reference}` : "/area-cliente",
    { agent, ...(reference ? { ref: reference } : {}) }
  );
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

const LANG_NAMES: Record<string, string> = {
  fr: "francés",
  en: "inglés",
  de: "alemán",
  it: "italiano",
  pt: "portugués",
  ro: "rumano",
  ca: "catalán",
  nl: "neerlandés",
  no: "noruego",
  sv: "sueco",
  ar: "árabe",
  es: "español",
};

export function formatLangName(code?: string | null) {
  if (!code) return "";
  return LANG_NAMES[code.toLowerCase()] || code;
}

export function buildPresupuestoMessage(opts?: { lang?: string | null }) {
  const langName = formatLangName(opts?.lang);
  const combinacion = langName ? `${langName} ↔ español` : "";
  return [
    "Hola, quiero pedir un presupuesto de traducción jurada.",
    `• Combinación de idiomas: ${combinacion}`,
    "• Tipo de documento: ",
    "• Email de contacto: ",
  ].join("\n");
}

export function buildPresupuestoWhatsAppLink(opts?: { lang?: string | null }) {
  return buildWhatsAppLinkFromText(buildPresupuestoMessage(opts));
}

const LANG_PATH_REGEX = /^\/traductor-jurado-([a-z]+)/i;
const LANG_SLUG_TO_CODE: Record<string, string> = {
  frances: "fr",
  ingles: "en",
  aleman: "de",
  italiano: "it",
  portugues: "pt",
  rumano: "ro",
  catalan: "ca",
  neerlandes: "nl",
  noruego: "no",
  sueco: "sv",
};

export function detectLangFromPathname(pathname?: string | null): string | null {
  if (!pathname) return null;
  const match = pathname.match(LANG_PATH_REGEX);
  if (!match) return null;
  return LANG_SLUG_TO_CODE[match[1].toLowerCase()] || null;
}

export const WHATSAPP_LINK = buildPresupuestoWhatsAppLink();

export const EMAIL = "hola@traduccionesjuradas.net";
const SUBJECT = "Presupuesto traducción jurada";

export const MAIL_LINK = `mailto:${EMAIL}?subject=${encodeURIComponent(
  SUBJECT
)}`;
