import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendMail, isEmailConfigured } from "@/lib/azure-mail";
import { sendNotification, formatPhoneSpain } from "@/lib/sms";
import { smsAcuseSolicitudPrecio, type SmsLang } from "@/lib/sms-templates";

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
  params: { to: string; subject: string; body: string },
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
}) {
  const html = renderSimpleEmailHtml(params.body);

  await sendMail({
    to: params.to,
    subject: params.subject,
    html,
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
}): Promise<{ channel: "email" | "sms" | null }> {
  const lang: SmsLang = opts.locale === "fr" ? "fr" : "es";
  const email = (opts.email || "").trim();
  const phone = (opts.phone || "").trim() || phoneFromPlaceholder(email);
  try {
    if (email && !isPlaceholderEmail(email)) {
      const name = (opts.name || "").trim();
      const body =
        lang === "fr"
          ? `Bonjour${name ? ` ${name}` : ""},\n` +
            "Nous avons bien reçu votre demande de devis : un traducteur assermenté nommé par le MAEC étudie vos documents et prépare sa proposition.\n" +
            "Vous recevrez très prochainement le devis avec le prix et le délai. Vous n'avez rien d'autre à faire.\n" +
            "Merci de votre confiance."
          : `Hola${name ? ` ${name}` : ""},\n` +
            "Hemos recibido tu solicitud de presupuesto y ya está en marcha: un traductor jurado nombrado por el MAEC está estudiando tus documentos y preparando su propuesta.\n" +
            "En breve recibirás el presupuesto con el precio y el plazo. No tienes que hacer nada más.\n" +
            "Gracias por tu confianza.";
      await sendMail({
        to: email,
        subject:
          lang === "fr"
            ? "Votre demande est en cours — traduccionesjuradas.net"
            : "Tu solicitud está en marcha — traduccionesjuradas.net",
        html: renderSimpleEmailHtml(body),
      });
      return { channel: "email" };
    }
    if (phone) {
      const acuse = await sendNotification({
        to: formatPhoneSpain(phone),
        body: smsAcuseSolicitudPrecio(lang),
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
