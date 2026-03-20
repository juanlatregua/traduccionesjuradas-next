import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendMail, isEmailConfigured } from "@/lib/azure-mail";

export function isQuoteEmailConfigured() {
  return isEmailConfigured();
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
