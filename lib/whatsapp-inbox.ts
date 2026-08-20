// WhatsApp entrante (Twilio) → bandeja unificada (InboundEmail, channel
// WHATSAPP) y respuesta por WhatsApp desde la bandeja.
//
// El remitente de la bandeja es WHATSAPP_INBOX_FROM (p. ej. el sandbox
// "whatsapp:+14155238886" o el número de Twilio dado de alta como sender).
// A PROPÓSITO no se usa TWILIO_WHATSAPP_FROM: esa env desvía TODAS las
// notificaciones de sendNotification a WhatsApp (incidente 2026-05-28).

import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { twilioSend } from "@/lib/sms";
import { matchClientContext } from "@/lib/inbox";
import { verifyTwilioSignature, whatsappLocalEmail, phoneFromWhatsAppAddress } from "@/lib/twilio-signature";

export { verifyTwilioSignature, whatsappLocalEmail, phoneFromWhatsAppAddress };

export const WHATSAPP_MEDIA_ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/heic",
  "image/tiff",
  "image/webp",
]);
const MEDIA_MAX_BYTES = 20 * 1024 * 1024;

export type InboundMedia = { url: string; contentType: string; name: string; size: number };

export function getWhatsAppInboxFrom(): string | null {
  const v = (process.env.WHATSAPP_INBOX_FROM || "").trim();
  if (!v) return null;
  return v.startsWith("whatsapp:") ? v : `whatsapp:${v}`;
}

export function isWhatsAppInboxConfigured(): boolean {
  return Boolean(getWhatsAppInboxFrom() && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

async function downloadTwilioMedia(url: string): Promise<Buffer> {
  const sid = process.env.TWILIO_ACCOUNT_SID || "";
  const token = process.env.TWILIO_AUTH_TOKEN || "";
  const res = await fetch(url, {
    headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Twilio media ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function extFor(contentType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "image/tiff": "tif",
    "image/webp": "webp",
  };
  return map[contentType] || "bin";
}

export type TwilioInboundForm = Record<string, string>;

export type IngestResult = { id: string; created: boolean; media: number; fromPhone: string; preview: string };

/** Persiste un WhatsApp entrante de Twilio (idempotente por MessageSid). */
export async function ingestWhatsAppMessage(form: TwilioInboundForm): Promise<IngestResult> {
  const sid = String(form.MessageSid || form.SmsMessageSid || "").trim();
  const from = phoneFromWhatsAppAddress(String(form.From || ""));
  if (!sid || !from) throw new Error("Webhook sin MessageSid/From.");
  const body = String(form.Body || "").trim();
  const profileName = String(form.ProfileName || "").trim() || null;
  const numMedia = Math.min(Number(form.NumMedia) || 0, 10);

  const existing = await prisma.inboundEmail.findUnique({ where: { graphId: sid }, select: { id: true } });
  if (existing) return { id: existing.id, created: false, media: 0, fromPhone: from, preview: body.slice(0, 80) };

  const media: InboundMedia[] = [];
  for (let i = 0; i < numMedia; i += 1) {
    const url = form[`MediaUrl${i}`];
    const contentType = String(form[`MediaContentType${i}`] || "application/octet-stream").toLowerCase();
    if (!url) continue;
    try {
      const buf = await downloadTwilioMedia(url);
      if (buf.length === 0 || buf.length > MEDIA_MAX_BYTES) continue;
      const name = `whatsapp-${sid.slice(-8)}-${i + 1}.${extFor(contentType)}`;
      const blob = await put(`inbox/whatsapp/${Date.now()}-${name}`, buf, { access: "public", contentType });
      media.push({ url: blob.url, contentType, name, size: buf.length });
    } catch (err) {
      console.error("[whatsapp-inbox] media download failed", sid, i, err);
    }
  }

  const fromEmail = whatsappLocalEmail(from);
  const match = await matchClientContext(fromEmail, from);
  const subject =
    body.split(/\n/)[0]?.slice(0, 90) ||
    (media.length ? `WhatsApp con ${media.length} archivo${media.length === 1 ? "" : "s"}` : "WhatsApp");
  const preview = body || (media.length ? `[${media.length} archivo(s) adjunto(s)]` : "");

  const row = await prisma.inboundEmail.create({
    data: {
      graphId: sid,
      channel: "WHATSAPP",
      fromEmail,
      fromPhone: from,
      fromName: profileName,
      subject,
      bodyPreview: preview.slice(0, 500),
      bodyText: body || null,
      mediaJson: media.length ? (media as any) : undefined,
      receivedAt: new Date(),
      customerId: match.customerId,
      quoteId: match.quoteId,
      orderReference: match.orderReference,
    },
    select: { id: true },
  });
  return { id: row.id, created: true, media: media.length, fromPhone: from, preview: preview.slice(0, 80) };
}

/** Respuesta por WhatsApp desde la bandeja (sesión de 24 h; fuera de ella Twilio falla con 63016). */
export async function sendWhatsAppInboxReply(toPhoneE164: string, body: string): Promise<void> {
  const from = getWhatsAppInboxFrom();
  if (!from) throw new Error("WHATSAPP_INBOX_FROM no configurado (remitente de WhatsApp de la bandeja).");
  const res = await twilioSend(`whatsapp:${toPhoneE164}`, from, body);
  if (!res.ok) {
    const err = res.error || "";
    if (/63016/.test(err)) {
      throw new Error(
        "Fuera de la ventana de 24 h desde el último mensaje del cliente: WhatsApp solo admite plantillas aprobadas. Responde por SMS/email o espera a que te escriba."
      );
    }
    throw new Error(`Twilio: ${err.slice(0, 300)}`);
  }
}
