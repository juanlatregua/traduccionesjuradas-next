// Webhook de Twilio para WhatsApp entrante ("When a message comes in").
// Verifica la firma, persiste el mensaje (+ medias a Blob) en la bandeja
// unificada y avisa al staff por SMS (con un número de Twilio el WhatsApp ya
// no suena en el móvil: sin aviso, el mensaje es invisible hasta abrir la
// bandeja). Responde TwiML vacío: nunca autocontesta al cliente.
import { NextResponse } from "next/server";
import { ingestWhatsAppMessage, verifyTwilioSignature } from "@/lib/whatsapp-inbox";
import { sendStaffAlertSMS } from "@/lib/sms";

export const runtime = "nodejs";
export const maxDuration = 60;

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twiml(status = 200) {
  return new NextResponse(EMPTY_TWIML, { status, headers: { "Content-Type": "text/xml" } });
}

function publicWebhookUrl(req: Request): string {
  const fixed = (process.env.WHATSAPP_WEBHOOK_URL || "").trim();
  if (fixed) return fixed;
  const base = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  const path = new URL(req.url).pathname;
  return `${base}${path}`;
}

export async function POST(req: Request) {
  let params: Record<string, string> = {};
  try {
    const form = await req.formData();
    form.forEach((v, k) => {
      params[k] = typeof v === "string" ? v : "";
    });
  } catch {
    return NextResponse.json({ ok: false, error: "form-urlencoded esperado" }, { status: 400 });
  }

  const signature = req.headers.get("x-twilio-signature");
  if (!verifyTwilioSignature(publicWebhookUrl(req), params, signature)) {
    console.warn("[whatsapp:inbound] firma inválida", { from: params.From, sid: params.MessageSid });
    return NextResponse.json({ ok: false, error: "firma inválida" }, { status: 403 });
  }

  try {
    const r = await ingestWhatsAppMessage(params);
    if (r.created) {
      await sendStaffAlertSMS(
        `WhatsApp de ${params.ProfileName || r.fromPhone} (${r.fromPhone})${r.media ? ` +${r.media} archivo(s)` : ""}: ${r.preview || "(sin texto)"} → /admin/inbox`,
        `whatsapp-inbound ${r.id}`
      ).catch((e) => console.error("[whatsapp:inbound] aviso staff falló", e));
    }
    return twiml();
  } catch (err) {
    console.error("[whatsapp:inbound] error", err);
    // 200 igualmente: Twilio reintenta con 5xx y no queremos duplicar avisos;
    // el mensaje sigue en Twilio y el error queda en logs.
    return twiml();
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, webhook: "whatsapp-inbound" });
}
