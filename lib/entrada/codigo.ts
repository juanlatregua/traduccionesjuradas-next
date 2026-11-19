import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { EntradaLang } from "./i18n.ts";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
export const codeHashOf = (entradaId: string, code: string) => createHash("sha256").update(`entrada-code:${entradaId}:${code}`).digest("hex");

export const newLinkToken = () => randomBytes(24).toString("base64url");
export const linkHashOf = (token: string) => createHash("sha256").update(`entrada-link:${token}`).digest("hex");

export function codeMatches(entradaId: string, code: string, stored: string): boolean {
  const a = Buffer.from(codeHashOf(entradaId, code), "hex");
  const b = Buffer.from(stored, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// The code goes first in the subject and the body («Tu código: 123456»): that is the shape iOS/macOS Mail offers
// to fill in a one-time-code field. The button confirms without typing anything.
const TEXT: Record<EntradaLang, { label: string; intro: string; button: string; expiry: string; ignore: string }> = {
  es: { label: "Tu código", intro: "Escríbelo en la web o pulsa el botón para confirmar tu email:", button: "Confirmar mi email", expiry: "El código y el botón caducan en 10 minutos.", ignore: "Si no has sido tú, ignora este mensaje." },
  fr: { label: "Votre code", intro: "Saisissez-le sur le site ou appuyez sur le bouton pour confirmer votre e-mail :", button: "Confirmer mon e-mail", expiry: "Le code et le bouton expirent dans 10 minutes.", ignore: "Si ce n'est pas vous, ignorez ce message." },
  en: { label: "Your code", intro: "Type it on the website or press the button to confirm your email:", button: "Confirm my email", expiry: "The code and the button expire in 10 minutes.", ignore: "If this wasn't you, ignore this message." },
  de: { label: "Ihr Code", intro: "Geben Sie ihn auf der Website ein oder drücken Sie die Schaltfläche, um Ihre E-Mail zu bestätigen:", button: "E-Mail bestätigen", expiry: "Code und Schaltfläche laufen in 10 Minuten ab.", ignore: "Wenn Sie das nicht waren, ignorieren Sie diese Nachricht." },
  pt: { label: "Seu código", intro: "Digite-o no site ou toque no botão para confirmar seu e-mail:", button: "Confirmar meu e-mail", expiry: "O código e o botão expiram em 10 minutos.", ignore: "Se não foi você, ignore esta mensagem." },
};

export function codeEmail(lang: string | null | undefined, code: string, linkUrl: string): { subject: string; html: string; text: string } {
  const t = TEXT[(lang as EntradaLang) in TEXT ? (lang as EntradaLang) : "es"];
  const first = `${t.label}: ${code}`;
  return {
    subject: `${first} — TraduccionesJuradas.net`,
    text: `${first}\n\n${t.intro}\n${linkUrl}\n\n${t.expiry}\n${t.ignore}`,
    html: `<p style="font-size:22px;font-weight:700">${first}</p><p>${t.intro}</p><p><a href="${linkUrl}" style="display:inline-block;background:#1f3a5f;color:#fff;padding:14px 28px;border-radius:10px;font-size:18px;font-weight:700;text-decoration:none">${t.button}</a></p><p>${t.expiry}</p><p style="color:#666">${t.ignore}</p>`,
  };
}
