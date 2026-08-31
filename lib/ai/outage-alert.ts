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

/**
 * Aviso de un análisis que se PIERDE por el documento (truncado, JSON inválido,
 * timeout, PDF cifrado…), no por la cuenta. Hueco real: `isAiAccountError` solo
 * reconoce fallos de cuenta, así que un "TRUNCATED" no avisaba a nadie — y en la
 * BD había 36 análisis fallidos de 216, con 29 de esos clientes yéndose sin
 * dejar email. Cada uno es un lead perdido en silencio.
 *
 * Email siempre; SMS solo cuando hay contacto que rescatar (si no hay email del
 * cliente no hay nada que perseguir y no merece despertar a nadie). Un aviso
 * cada media hora como mucho: un lote que falla entero avisa una vez.
 */
export async function alertStaffAnalysisFailure(input: {
  where: string;
  detail: string;
  documentId?: string | null;
  fileName?: string | null;
  clientEmail?: string | null;
}): Promise<void> {
  try {
    const gate = await checkRateLimit({
      key: "ai-analysis-failure-alert",
      limit: 1,
      windowMs: 30 * 60 * 1000,
    });
    if (!gate.ok) return;
    const adminEmail = process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";
    const contacto = input.clientEmail?.trim();
    const texto = [
      `Un análisis ha fallado en ${input.where} y el cliente ha visto el error.`,
      "",
      `Documento: ${input.fileName || "(sin nombre)"}${input.documentId ? ` · id ${input.documentId}` : ""}`,
      `Cliente: ${contacto || "SIN EMAIL — este lead se pierde entero"}`,
      `Causa: ${input.detail.slice(0, 400)}`,
      "",
      contacto
        ? "Se puede rescatar: escríbele tú y pídele el documento por email o WhatsApp."
        : "No hay a quién escribir. Si se repite, hay un problema de fondo.",
      "Este aviso se repite como mucho una vez cada 30 minutos.",
    ].join("\n");
    await Promise.all([
      sendMail({
        to: adminEmail,
        subject: `⚠ Análisis fallido en la puerta${contacto ? " — hay lead que rescatar" : ""}`,
        text: texto,
        html: renderSimpleEmailHtml(texto),
      }).catch((err) => console.error("[analysis-failure] email fallo:", err)),
      contacto
        ? sendStaffAlertSMS(
            `TraduccionesJuradas: analisis fallido en la puerta. Lead con email (${contacto.slice(0, 40)}) que se puede rescatar. Mira el correo.`,
            "analysis_failure"
          ).catch(() => {})
        : Promise.resolve(),
    ]);
  } catch (err) {
    console.error("[analysis-failure] aviso fallo:", err);
  }
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

/**
 * "Nunca puedo perder" (Juan, 28-ago-2026): un encargo adjudicado que deja la
 * casa a cero o en negativo avisa por los DOS canales. Cuando esto salta, el
 * cliente ya pagó y el jurado ya tiene su cifra: no hay freno posible, solo
 * enterarse a tiempo para renegociar. Sin límite de frecuencia — cada euro
 * perdido es un caso distinto y no se agrupan.
 */
export async function alertStaffMargin(input: {
  orderId: string;
  assignmentId: string;
  supplier: string;
  revenueNetCents: number;
  supplierCostCents: number;
  marginCents: number;
}): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const order = await prisma.order
      .findUnique({ where: { id: input.orderId }, select: { reference: true, clientName: true, langPair: true } })
      .catch(() => null);
    const ref = order?.reference || input.orderId;
    const eur = (c: number) => `${(c / 100).toFixed(2)} €`;
    const adminEmail = process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";
    const texto = [
      `El pedido ${ref} se ha adjudicado SIN MARGEN.`,
      "",
      `Cliente: ${order?.clientName || "—"} · ${order?.langPair || "—"}`,
      `Traductor: ${input.supplier}`,
      `Ingreso neto: ${eur(input.revenueNetCents)}`,
      `Coste del traductor: ${eur(input.supplierCostCents)}`,
      `MARGEN: ${eur(input.marginCents)}`,
      "",
      input.marginCents < 0
        ? "Estás pagando más de lo que cobras por este encargo."
        : "Haces la gestión, adelantas el dinero y asumes el riesgo por cero.",
      "El cliente ya pagó y el traductor ya tiene su cifra: si hay que mover algo, hay que hacerlo ahora.",
      `https://www.traduccionesjuradas.net/zona-traductor/pedido/${ref}`,
    ].join("\n");
    await Promise.all([
      sendMail({
        to: adminEmail,
        subject: `⚠ ${ref} adjudicado sin margen (${eur(input.marginCents)})`,
        text: texto,
        html: renderSimpleEmailHtml(texto),
      }).catch((err) => console.error("[margen] email fallo:", err)),
      sendStaffAlertSMS(
        `TraduccionesJuradas: ${ref} adjudicado SIN MARGEN (${eur(input.marginCents)}). ${input.supplier}. Mira el email.`,
        `margen_cero ${ref}`
      ).catch(() => {}),
    ]);
  } catch (err) {
    console.error("[margen] aviso fallo:", err);
  }
}
