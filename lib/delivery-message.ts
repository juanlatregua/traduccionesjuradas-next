// Textos del aviso de entrega al cliente (email y WhatsApp). Puro: sin Prisma ni envío.

export type DeliveryLang = "es" | "fr" | "en";

export const DEFAULT_REVIEW_URL = "https://www.google.com/maps?cid=1858671208989418611";

export function getReviewUrl(): string {
  const env = (process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL_TJ || "").trim();
  return env.startsWith("http") ? env : DEFAULT_REVIEW_URL;
}

// Alias de email («alejandrosilvera7»): una sola palabra igual a la parte local del email.
export function isEmailAlias(name: string | null | undefined, email: string | null | undefined): boolean {
  const n = (name || "").trim().toLowerCase();
  const local = (email || "").split("@")[0].trim().toLowerCase();
  return !!n && !/\s/.test(n) && n === local;
}

// Nombre para saludar: sin espacios sobrantes ni signos de saludo, y vacío si es un alias de email.
export function greetingName(name: string | null | undefined, email?: string | null): string {
  const n = (name || "").replace(/\s+/g, " ").replace(/^[\s,:;]+|[\s,:;]+$/g, "");
  return isEmailAlias(n, email) ? "" : n;
}

export function toDeliveryLang(locale: string | null | undefined): DeliveryLang {
  return locale === "fr" ? "fr" : locale === "en" ? "en" : "es";
}

// Texto que ocupa el nº de factura en la vista previa cuando aún no se ha emitido.
export const INVOICE_NUMBER_PLACEHOLDER = "(nº al emitir)";

// Con número, rellena el hueco; sin él, quita la frase entera de la factura.
export function resolveInvoicePlaceholder(message: string, invoiceNumber: string | null): string {
  if (invoiceNumber) return message.split(INVOICE_NUMBER_PLACEHOLDER).join(invoiceNumber);
  return message
    .replace(new RegExp(` (?:y la factura|et la facture|and invoice) ${INVOICE_NUMBER_PLACEHOLDER.replace(/[()]/g, "\\$&")}`, "g"), "")
    .split(INVOICE_NUMBER_PLACEHOLDER)
    .join("");
}

export const DELIVERY_SIGNATURE = "Juan Silva — TraduccionesJuradas.net";

const COPY = {
  es: {
    hello: (n: string) => (n ? `Buenos días, ${n}:` : "Buenos días:"),
    attached: (ref: string, inv: string) => `Le adjunto la traducción jurada${inv ? ` y la factura ${inv}` : ""} del pedido ${ref}.`,
    corrected: (ref: string) => `Le adjunto la traducción corregida del pedido ${ref}.`,
    here: (ref: string) => `Aquí tiene la traducción jurada del pedido ${ref}`,
    review: (url: string) => `Si le ha sido útil, nos ayuda mucho su valoración en Google: ${url}`,
    bye: "Un saludo,",
    subject: (ref: string, c: boolean) => `Traducción jurada${c ? " corregida" : ""} — pedido ${ref}`,
    download: "Descarga",
  },
  fr: {
    hello: (n: string) => (n ? `Bonjour ${n},` : "Bonjour,"),
    attached: (ref: string, inv: string) => `Veuillez trouver ci-joint la traduction assermentée${inv ? ` et la facture ${inv}` : ""} de la commande ${ref}.`,
    corrected: (ref: string) => `Veuillez trouver ci-joint la traduction corrigée de la commande ${ref}.`,
    here: (ref: string) => `Voici la traduction assermentée de la commande ${ref}`,
    review: (url: string) => `Si elle vous a été utile, votre avis sur Google nous aide beaucoup : ${url}`,
    bye: "Cordialement,",
    subject: (ref: string, c: boolean) => `Traduction assermentée${c ? " corrigée" : ""} — commande ${ref}`,
    download: "Téléchargement",
  },
  en: {
    hello: (n: string) => (n ? `Hello ${n},` : "Hello,"),
    attached: (ref: string, inv: string) => `Please find attached the sworn translation${inv ? ` and invoice ${inv}` : ""} for order ${ref}.`,
    corrected: (ref: string) => `Please find attached the corrected translation for order ${ref}.`,
    here: (ref: string) => `Here is the sworn translation for order ${ref}`,
    review: (url: string) => `If it was useful, a Google review helps us a lot: ${url}`,
    bye: "Kind regards,",
    subject: (ref: string, c: boolean) => `Sworn translation${c ? " (corrected)" : ""} — order ${ref}`,
    download: "Download",
  },
} as const;

export function deliverySubject(lang: DeliveryLang, reference: string, correction = false): string {
  return COPY[lang].subject(reference, correction);
}

// Texto plano del email de entrega. La factura solo se nombra si existe.
export function buildDeliveryText(input: {
  lang: DeliveryLang;
  name?: string | null;
  reference: string;
  invoiceNumber?: string | null;
  correction?: boolean;
  reviewUrl: string;
}): string {
  const c = COPY[input.lang];
  const inv = input.correction ? "" : (input.invoiceNumber || "").trim();
  return [
    c.hello(greetingName(input.name)),
    input.correction ? c.corrected(input.reference) : c.attached(input.reference, inv),
    c.review(input.reviewUrl),
    `${c.bye}\n${DELIVERY_SIGNATURE}`,
  ].join("\n\n");
}

// Mensaje corto para WhatsApp: enlaces a las traducciones en vez de adjuntos.
export function buildDeliveryWhatsappText(input: {
  lang?: DeliveryLang;
  name?: string | null;
  reference: string;
  files: { name: string; url?: string }[];
  reviewUrl: string;
}): string {
  if (input.files.length === 0) return "";
  const c = COPY[input.lang || "es"];
  const links =
    input.files.length === 1
      ? `${c.here(input.reference)}: ${input.files[0].url || ""}`
      : `${c.here(input.reference)}:\n${input.files.map((f) => `• ${f.name}: ${f.url || ""}`).join("\n")}`;
  return [c.hello(greetingName(input.name)), links, c.review(input.reviewUrl), `${c.bye}\n${DELIVERY_SIGNATURE}`].join("\n\n");
}

// Si algún adjunto no pudo ir en el correo, su enlace se añade antes de la reseña.
export function appendDownloadLinks(text: string, lang: DeliveryLang, links: string[]): string {
  if (links.length === 0) return text;
  const block = links.map((u) => `${COPY[lang].download}: ${u}`).join("\n");
  const parts = text.split("\n\n");
  parts.splice(Math.max(parts.length - 2, 1), 0, block);
  return parts.join("\n\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Texto plano → HTML del cuerpo (párrafos, saltos de línea y enlaces).
export function deliveryTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => {
      const html = escapeHtml(p.trim()).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>");
      return `<p style="margin:0 0 14px 0;">${html}</p>`;
    })
    .join("");
}

export type RequiredDeliveryData = {
  reference: string;
  invoiceNumber: string | null;
  reviewUrl: string;
};

// Datos que la IA no puede tocar al reescribir el mensaje de entrega.
export function missingRequiredData(text: string, req: RequiredDeliveryData): string[] {
  const missing: string[] = [];
  if (!text.includes(req.reference)) missing.push("número de pedido");
  if (req.invoiceNumber && !text.includes(req.invoiceNumber)) missing.push("número de factura");
  if (!text.includes(req.reviewUrl)) missing.push("enlace de reseña");
  if (!text.includes(DELIVERY_SIGNATURE)) missing.push("firma");
  return missing;
}

export const AI_REQUIRED_DATA_ERROR = "La IA ha quitado un dato obligatorio; no se ha aplicado";

// Instrucción para la IA: la del staff + lo que debe conservar sin cambios.
export function buildDeliveryAiInstruction(instruction: string, req: RequiredDeliveryData): string {
  const keep = [
    `el número de pedido ${req.reference}`,
    req.invoiceNumber ? `el número de factura ${req.invoiceNumber}` : "",
    `la URL de reseña de Google ${req.reviewUrl}`,
    `la firma «${DELIVERY_SIGNATURE}»`,
  ].filter(Boolean);
  return `${instruction.trim() || "Mejora el texto manteniéndolo breve y cordial."}\n\nConserva SIN CAMBIOS, tal cual: ${keep.join("; ")}. No inventes datos ni añadas enlaces.`;
}

export const AI_LANGUAGES = ["Español", "Français", "English", "Português", "Deutsch", "Italiano"] as const;

export function translateInstruction(language: string): string {
  return `Traduce el mensaje a ${language}, mismo tono breve y cordial, usted.`;
}
