import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendMail, isEmailConfigured } from "@/lib/azure-mail";

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

export function previewQuoteEmail(params: { subject: string; body: string }) {
  return {
    subject: params.subject,
    body: params.body,
    html: renderSimpleEmailHtml(params.body),
  };
}
