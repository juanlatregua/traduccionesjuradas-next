import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { EntradaLang } from "./i18n.ts";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const codeHashOf = (entradaId: string, code: string) => createHash("sha256").update(`entrada-code:${entradaId}:${code}`).digest("hex");

export function codeMatches(entradaId: string, code: string, stored: string): boolean {
  const a = Buffer.from(codeHashOf(entradaId, code), "hex");
  const b = Buffer.from(stored, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

const TEXT: Record<EntradaLang, { subject: (c: string) => string; intro: string; expiry: string; ignore: string }> = {
  es: { subject: (c) => `${c} es tu código de TraduccionesJuradas.net`, intro: "Este es tu código para que revisemos tus documentos:", expiry: "Caduca en 10 minutos.", ignore: "Si no has sido tú, ignora este mensaje." },
  fr: { subject: (c) => `${c} est votre code TraduccionesJuradas.net`, intro: "Voici votre code pour que nous examinions vos documents :", expiry: "Il expire dans 10 minutes.", ignore: "Si ce n'est pas vous, ignorez ce message." },
  en: { subject: (c) => `${c} is your TraduccionesJuradas.net code`, intro: "Here is your code so we can review your documents:", expiry: "It expires in 10 minutes.", ignore: "If this wasn't you, ignore this message." },
  de: { subject: (c) => `${c} ist Ihr Code von TraduccionesJuradas.net`, intro: "Ihr Code, damit wir Ihre Dokumente prüfen können:", expiry: "Er läuft in 10 Minuten ab.", ignore: "Wenn Sie das nicht waren, ignorieren Sie diese Nachricht." },
  pt: { subject: (c) => `${c} é o seu código da TraduccionesJuradas.net`, intro: "Este é o seu código para revisarmos os seus documentos:", expiry: "Expira em 10 minutos.", ignore: "Se não foi você, ignore esta mensagem." },
};

export function codeEmail(lang: string | null | undefined, code: string): { subject: string; html: string } {
  const t = TEXT[(lang as EntradaLang) in TEXT ? (lang as EntradaLang) : "es"];
  return {
    subject: t.subject(code),
    html: `<p>${t.intro}</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>${t.expiry}</p><p style="color:#666">${t.ignore}</p>`,
  };
}
