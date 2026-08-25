// Aviso a staff cuando la IA falla por la CUENTA (límite de gasto mensual,
// crédito, clave) y no por el documento. Incidente 24/25-ago-2026: la clave de
// Anthropic tocó el límite mensual ("You have reached your specified API usage
// limits") y durante ~18 h toda subida a la puerta acabó en "No hemos podido
// analizar el documento" sin que nadie lo supiera (Maider Castorene, Marcos
// Lopes en el chat). Dos transportes (email + SMS), un aviso por hora.
import { checkRateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/azure-mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendStaffAlertSMS } from "@/lib/sms";

const ACCOUNT_ERROR_RE =
  /usage limits?|credit balance|billing|insufficient|invalid x-api-key|authentication_error|permission_error|rate_limit_error|overloaded_error/i;

/** true si el error viene de la cuenta/servicio de Anthropic, no del documento. */
export function isAiAccountError(err: any): boolean {
  const status = Number(err?.status || 0);
  const msg = String(err?.error?.error?.message || err?.message || "");
  if ([401, 402, 403, 429, 529].includes(status)) return true;
  return ACCOUNT_ERROR_RE.test(msg);
}

export async function alertStaffAiOutage(where: string, detail: string): Promise<void> {
  try {
    const gate = await checkRateLimit({ key: "ai-outage-alert", limit: 1, windowMs: 60 * 60 * 1000 });
    if (!gate.ok) return;
    const adminEmail = process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";
    const texto = [
      `La IA ha fallado en ${where} por un problema de CUENTA (no del documento):`,
      detail.slice(0, 500),
      "Mientras dure, la puerta no da precios y el chat no responde; los leads ven el botón de pedir presupuesto.",
      "Revisar: https://console.anthropic.com/settings/limits (límite mensual) y https://console.anthropic.com/settings/billing (crédito).",
      "Este aviso se repite como mucho una vez por hora.",
    ].join("\n");
    await Promise.all([
      sendMail({
        to: adminEmail,
        subject: "⚠ IA caída por cuenta Anthropic — la puerta no analiza",
        text: texto,
        html: renderSimpleEmailHtml(texto),
      }).catch((err) => console.error("[ai-outage] email fallo:", err)),
      sendStaffAlertSMS(
        "TraduccionesJuradas: la IA falla por CUENTA Anthropic (limite/credito). La puerta no analiza. Mira el email.",
        "ai_outage"
      ).catch(() => {}),
    ]);
  } catch (err) {
    console.error("[ai-outage] aviso fallo:", err);
  }
}
