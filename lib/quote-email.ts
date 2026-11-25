import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendMail, isEmailConfigured, type MailAttachment } from "@/lib/azure-mail";
import { sendClientNotification, formatPhoneSpain } from "@/lib/sms";
import { smsAcuseSolicitudPrecio, type SmsLang } from "@/lib/sms-templates";
import { checkRateLimit } from "@/lib/rate-limit";
import { findRecurrentClient } from "@/lib/recurrent-client-db";
import { priceRequestAckText, ackLangOf } from "@/lib/price-request-ack";
import { GOOGLE_RATING } from "@/lib/google-rating";

export function isQuoteEmailConfigured() {
  return isEmailConfigured();
}

/** Email-marcador de leads de WhatsApp: NO es entregable por correo. */
export function isPlaceholderEmail(email: string | null | undefined) {
  return /@whatsapp\.local$/i.test(email || "");
}

/**
 * Igual que sendQuoteEmail pero con reintentos (backoff 2s/4s) ante fallos
 * transitorios de Graph. Lanza el último error si agota los intentos, de modo
 * que el llamador pueda registrar el fallo (MessageLog FAILED) y avisar al staff.
 */
export async function sendQuoteEmailWithRetry(
  params: { to: string; subject: string; body: string; attachments?: MailAttachment[] },
  maxRetries = 3
) {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendQuoteEmail(params);
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }
  throw lastErr;
}

export async function sendQuoteEmail(params: {
  to: string;
  subject: string;
  body: string;
  attachments?: MailAttachment[];
}) {
  const html = renderSimpleEmailHtml(params.body);

  await sendMail({
    to: params.to,
    subject: params.subject,
    html,
    attachments: params.attachments?.length ? params.attachments : undefined,
  });

  // Graph API does not return a provider message ID
  return {
    providerId: null as string | null,
    html,
  };
}

/** Dígitos del email-marcador como teléfono internacional (+4917… de 4917…@whatsapp.local). */
export function phoneFromPlaceholder(email: string | null | undefined): string | null {
  const m = /^(\d{7,15})@whatsapp\.local$/i.exec((email || "").trim());
  return m ? `+${m[1]}` : null;
}

/**
 * Acuse al cliente al aceptarse su solicitud de precio vía lavori (petición Juan
 * 24-ago, "que salga automáticamente"): UN solo canal — email si es real, SMS si
 * es marcador de WhatsApp o no hay email. Nunca lanza: el acuse no tumba el POST.
 * Llamar con await (sin él la lambda se congela al responder — E2E 12-ago).
 */
export async function sendPriceRequestAckToClient(opts: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  locale?: string | null;
  /** Lengua del jurado que ya tiene el documento (carril lavori disparado): "alemán" */
  translatorLangName?: string | null;
  /** No sabemos su fecha límite: se la pedimos (26-oct-2026). */
  askDeadline?: boolean;
  /** Nada ha salido todavía hacia un jurado: Juan lo revisa antes (no decir «ya está en marcha»). */
  inReview?: boolean;
  /** El par incluye francés: responde Juan; en otro caso, firma genérica. */
  byJuan?: boolean;
}): Promise<{ channel: "email" | "sms" | null }> {
  const lang = ackLangOf(opts.locale);
  const smsLang: SmsLang = lang === "fr" ? "fr" : "es";
  const email = (opts.email || "").trim();
  const phone = (opts.phone || "").trim() || phoneFromPlaceholder(email);
  try {
    // Dedupe 24 h por destinatario (guardián 24-ago): el mismo cliente puede
    // disparar el acuse dos veces por caminos distintos (pide presupuesto en la
    // puerta y luego Juan lanza la solicitud lavori desde el builder). El store
    // del rate-limit es la BD en prod: vale como memoria entre lambdas.
    const dedupeKey = `acuse-solicitud:${(email || phone || "").toLowerCase()}`;
    if (email || phone) {
      const first = await checkRateLimit({ key: dedupeKey, limit: 1, windowMs: 24 * 60 * 60 * 1000 });
      if (!first.ok) return { channel: null };
    }
    if (email && !isPlaceholderEmail(email)) {
      // Solo coincidencia por EMAIL (el cliente que vuelve); va a su propio buzón, nunca a pantalla pública.
      const recurrent = (await findRecurrentClient({ email, phone: null })).kind === "recurrent";
      const { subject, body } = priceRequestAckText(lang, { name: opts.name, translatorLangName: opts.translatorLangName, askDeadline: opts.askDeadline, inReview: opts.inReview, byJuan: opts.byJuan, recurrent, reviews: GOOGLE_RATING.reviews });
      await sendMail({
        to: email,
        subject,
        html: renderSimpleEmailHtml(body),
      });
      return { channel: "email" };
    }
    if (phone) {
      const acuse = await sendClientNotification({
        to: formatPhoneSpain(phone),
        body: smsAcuseSolicitudPrecio(smsLang, Boolean(opts.byJuan)),
      });
      if (!acuse.ok) {
        console.error("[price-request] acuse SMS al cliente fallo:", acuse.error);
        return { channel: null };
      }
      return { channel: "sms" };
    }
  } catch (err) {
    console.error("[price-request] acuse al cliente fallo:", err);
  }
  return { channel: null };
}

export function previewQuoteEmail(params: { subject: string; body: string }) {
  return {
    subject: params.subject,
    body: params.body,
    html: renderSimpleEmailHtml(params.body),
  };
}
