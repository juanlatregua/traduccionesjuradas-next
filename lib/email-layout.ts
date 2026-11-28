// Plantilla única de los emails (maqueta aprobada por Juan, 28-nov-2026). HTML de email:
// tablas e inline styles, sin webfonts ni SVG. Puro: sin imports de servidor.
import { LAYOUT_COPY, QUESTIONS_COPY, type CopyLang } from "./email-copy.ts";

export const SITE = "https://www.traduccionesjuradas.net";
export const EMAIL_LOGO_URL = `${SITE}/brand/logo-email.png`;
const WHATSAPP_URL = "https://wa.me/34951333614";

export const C = {
  page: "#EDE6D8",
  card: "#FDFAF4",
  border: "#E2D8C4",
  rule: "#EFE7D8",
  navy: "#1A2E4A",
  navySoft: "#24395A",
  gold: "#B8922A",
  goldText: "#816318",
  green: "#2D5016",
  cream: "#D8CFBE",
  ink: "#3D3630",
  muted: "#5F564E",
  soft: "#F7F1E6",
  coupon: "#FBF5E6",
  white: "#FFFFFF",
};

export const SERIF = "Georgia,'Times New Roman',serif";
export const SANS = "Arial,Helvetica,sans-serif";

export function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const attr = (url: string) => escapeHtml(url);

export type SignatureKind = "juan" | "house";

// Botón «bulletproof»: el relleno va en el borde del <a> para que Outlook lo pinte entero.
export function emailButton(label: string, url: string, opts: { variant?: "primary" | "outline"; size?: "md" | "sm" } = {}): string {
  const outline = opts.variant === "outline";
  const [py, px, fs] = opts.size === "sm" ? [12, 20, 15] : [16, 30, 17];
  const bg = outline ? C.card : C.navy;
  const fg = outline ? C.navy : C.white;
  const cell = outline ? `border:2px solid ${C.navy};` : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:6px 0 14px 0;"><tr><td align="center" bgcolor="${bg}" style="background:${bg};border-radius:8px;${cell}"><a href="${attr(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;font-family:${SANS};font-size:${fs}px;font-weight:bold;line-height:20px;color:${fg};text-decoration:none;border-radius:8px;border-top:${py}px solid ${bg};border-bottom:${py}px solid ${bg};border-left:${px}px solid ${bg};border-right:${px}px solid ${bg};">${escapeHtml(label)}</a></td></tr></table>`;
}

export function emailCard(inner: string, opts: { background?: string; border?: string; dashed?: boolean; padding?: string; radius?: number; margin?: string } = {}): string {
  const bg = opts.background || C.white;
  const border = opts.dashed ? `2px dashed ${C.gold}` : `1px solid ${opts.border || C.border}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:${opts.margin || "18px 0"};"><tr><td bgcolor="${bg}" style="background:${bg};border:${border};border-radius:${opts.radius ?? 10}px;padding:${opts.padding || "16px 20px"};font-family:${SANS};font-size:15px;line-height:1.55;color:${C.ink};">${inner}</td></tr></table>`;
}

export function emailSignature(kind: SignatureKind = "juan"): string {
  const juan = kind === "juan";
  const initials = juan ? "JS" : "TJ";
  const name = juan ? "Juan Silva Moreno" : "Traducciones Juradas";
  const role = juan ? "Traductor jurado de francés · MAEC nº 3850" : "HBTJ Consultores Lingüísticos S.L.";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0 0;border-top:1px solid ${C.rule};"><tr>
<td width="48" valign="middle" style="padding:22px 14px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="48" height="48" align="center" valign="middle" bgcolor="${C.navy}" style="width:48px;height:48px;background:${C.navy};border-radius:24px;font-family:${SERIF};font-size:17px;color:${C.white};">${initials}</td></tr></table></td>
<td valign="middle" style="padding:22px 0 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.muted};"><strong style="color:${C.navy};">${name}</strong><br>${role}<br>951 333 614 · <a href="${WHATSAPP_URL}" style="color:${C.navy};">${LAYOUT_COPY.whatsapp}</a></td>
</tr></table>`;
}

const LEGAL_NOTE =
  "<strong>Nota legal</strong> – Este mensaje se dirige exclusivamente a su destinatario y puede contener información confidencial sometida a secreto profesional. Si no es el destinatario autorizado, su uso o divulgación está prohibido; por favor comuníquelo y destrúyalo.";

export function emailLayout(opts: {
  content: string;
  label?: string | null;
  labelColor?: string;
  title?: string | null;
  signature?: SignatureKind | null;
  legalNote?: boolean;
  preheader?: string | null;
}): string {
  // El nº 3850 solo con la firma de Juan pedida a propósito (pares FR).
  const subtitle = opts.signature === "juan" ? "MÁLAGA · MAEC Nº 3850" : "MÁLAGA";
  const label = opts.label
    ? `<div style="font-family:${SANS};font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${opts.labelColor || C.goldText};margin:0 0 14px 0;">${escapeHtml(opts.label)}</div>`
    : "";
  const title = opts.title
    ? `<h1 style="margin:0 0 16px 0;font-family:${SERIF};font-weight:normal;font-size:28px;line-height:1.3;color:${C.navy};">${escapeHtml(opts.title)}</h1>`
    : "";
  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(opts.preheader)}</div>`
    : "";
  return `${preheader}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="width:100%;max-width:640px;background:${C.card};border:1px solid ${C.border};border-radius:14px;border-collapse:separate;">
<tr><td bgcolor="${C.navy}" style="background:${C.navy};padding:22px 32px;border-radius:14px 14px 0 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="padding:0 14px 0 0;"><a href="${SITE}" target="_blank" rel="noopener noreferrer"><img src="${EMAIL_LOGO_URL}" width="46" height="34" alt="TJ" style="display:block;border:0;outline:none;width:46px;height:34px;"></a></td>
<td valign="middle" style="font-family:${SERIF};font-size:19px;line-height:1.2;color:${C.white};">Traducciones Juradas<br><span style="font-family:${SANS};font-size:12px;letter-spacing:1.2px;color:${C.cream};">${subtitle}</span></td>
</tr></table>
</td></tr>
<tr><td style="padding:36px 40px 8px 40px;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.ink};">
${label}${title}${opts.content}${opts.signature ? emailSignature(opts.signature) : ""}
</td></tr>
<tr><td bgcolor="${C.soft}" style="background:${C.soft};padding:18px 40px 24px 40px;border-radius:0 0 14px 14px;font-family:${SANS};font-size:12px;line-height:1.55;color:${C.muted};">
HBTJ Consultores Lingüísticos S.L. · CIF B93712784 · Calle Esperanto, 9 · 29007 Málaga<br>
<a href="mailto:hola@traduccionesjuradas.net" style="color:${C.muted};">hola@traduccionesjuradas.net</a> · <a href="tel:+34951333614" style="color:${C.muted};">951 333 614</a><br>
${LAYOUT_COPY.privacy} <a href="${SITE}/privacidad" style="color:${C.muted};">${LAYOUT_COPY.privacyLink}</a>${opts.legalNote ? `<br><br>${LEGAL_NOTE}` : ""}
</td></tr>
</table>
</td></tr></table>`;
}

export function autolink(escapedText: string): string {
  return escapedText.replace(/(?<!href=")(https?:\/\/[^\s<"]+)/g, (u) => `<a href="${u}" style="color:${C.navy};">${u}</a>`);
}

// «Etiqueta: https://…» en una línea sola → botón con la etiqueta. Fuera: los enlaces de motivo (?fb=).
export function ctaFromLine(line: string): { label: string; url: string } | null {
  const m = /^(.{1,48}?)\s?:\s*(https?:\/\/\S+)$/.exec(line.trim());
  if (!m) return null;
  const label = m[1].trim().replace(/^[·•\-]\s*/, "");
  if (!label || /[.!?]$/.test(label) || /[?&]fb=/.test(m[2])) return null;
  return { label, url: m[2] };
}

// Texto plano (una línea = un párrafo) → HTML con botones para las llamadas a la acción.
export function textLinesToHtml(text: string, opts: { onFirstButton?: string } = {}): string {
  let injected = false;
  return String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const cta = ctaFromLine(line);
      if (cta) {
        const before = !injected && opts.onFirstButton ? opts.onFirstButton : "";
        injected = true;
        return `${before}${emailButton(cta.label, cta.url)}`;
      }
      return `<p style="margin:0 0 12px 0;">${autolink(escapeHtml(line))}</p>`;
    })
    .join("")
    .concat(!injected && opts.onFirstButton ? opts.onFirstButton : "");
}

export function emailQuestionsBox(lang: string | null | undefined): string {
  const q = QUESTIONS_COPY[(lang && lang in QUESTIONS_COPY ? lang : "es") as CopyLang];
  return emailCard(`<strong style="color:${C.navy};">${q.title}</strong><br>${q.body}`, { background: C.soft, border: C.soft, padding: "18px 20px", margin: "24px 0 8px 0" });
}

// Con la tarjeta de firma, la firma del texto («Juan Silva — …», «… – Juan Silva») sobra: se quita
// el nombre y se conserva la despedida.
export function stripTextSignature(text: string): string {
  return String(text)
    .split("\n")
    .map((line) => {
      if (/^\s*(?:[–—-]\s*)?Juan Silva\b/.test(line)) return null;
      const lead = /^(.*?,)\s*Juan Silva\b.*$/.exec(line);
      if (lead) return lead[1];
      return line.replace(/\s+[–—-]\s*Juan Silva\b.*$/, "");
    })
    .filter((l): l is string => l !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
