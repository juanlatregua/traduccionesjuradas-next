import sgMail from "@sendgrid/mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";

export function isQuoteEmailConfigured() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM);
}

export async function sendQuoteEmail(params: {
  to: string;
  subject: string;
  body: string;
}) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM;
  if (!apiKey) throw new Error("Missing SENDGRID_API_KEY");
  if (!from) throw new Error("Missing SENDGRID_FROM");

  sgMail.setApiKey(apiKey);
  const html = renderSimpleEmailHtml(params.body);
  const responseRaw = (await sgMail.send({
    to: params.to,
    from: { email: from, name: "Traducciones Juradas" },
    subject: params.subject,
    text: params.body,
    html,
  })) as any;

  const response = Array.isArray(responseRaw) ? responseRaw[0] : responseRaw;
  const providerId =
    response?.headers?.["x-message-id"] ||
    response?.headers?.["X-Message-Id"] ||
    response?.headers?.get?.("x-message-id") ||
    null;

  return {
    providerId: providerId ? String(providerId) : null,
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
