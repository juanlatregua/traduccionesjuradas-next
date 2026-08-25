// lib/sms.ts — Abstracción SMS + WhatsApp via Twilio

import { prisma } from "@/lib/prisma";

export type SMSMessage = {
  to: string; // formato E.164: +34600123456
  body: string;
  channel?: "sms" | "whatsapp";
};

/**
 * Twilio auth: prioriza Auth Token; fallback a API Key (TWILIO_API_KEY_SID + SECRET).
 */
function getTwilioAuth(): { user: string; pass: string } {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    return { user: process.env.TWILIO_ACCOUNT_SID!, pass: authToken };
  }
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  if (apiKeySid && apiKeySecret) {
    return { user: apiKeySid, pass: apiKeySecret };
  }
  return { user: process.env.TWILIO_ACCOUNT_SID!, pass: "" };
}

export async function twilioSend(
  to: string,
  from: string,
  body: string
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = getTwilioAuth();

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${auth.user}:${auth.pass}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[Twilio error]", err);
    return { ok: false, error: err };
  }

  const data = await res.json();
  return { ok: true, id: data.sid };
}

export async function sendSMS(
  msg: SMSMessage
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const provider = process.env.SMS_PROVIDER || "log";
  const channel = msg.channel || "sms";

  if (provider === "log" || process.env.NODE_ENV === "development") {
    console.log(`[${channel.toUpperCase()} → ${msg.to}] ${msg.body}`);
    return { ok: true, id: `dev-${Date.now()}` };
  }

  if (provider === "twilio") {
    if (channel === "whatsapp") {
      const waFrom = process.env.TWILIO_WHATSAPP_FROM;
      if (!waFrom) return { ok: false, error: "TWILIO_WHATSAPP_FROM not set" };
      return twilioSend(`whatsapp:${msg.to}`, waFrom, msg.body);
    }
    const from = process.env.TWILIO_FROM_NUMBER!;
    return twilioSend(msg.to, from, msg.body);
  }

  return { ok: false, error: `Unknown SMS provider: ${provider}` };
}

/**
 * Envía por WhatsApp si hay número de WhatsApp configurado, si no por SMS.
 */
export async function sendNotification(
  msg: Omit<SMSMessage, "channel">
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const hasWhatsApp = Boolean(process.env.TWILIO_WHATSAPP_FROM);
  if (hasWhatsApp) {
    const wa = await sendSMS({ ...msg, channel: "whatsapp" });
    if (wa.ok) return wa;
    console.error(
      `[sendNotification] WhatsApp fallo (${wa.error}); reintentando por SMS`
    );
  }
  return sendSMS({ ...msg, channel: "sms" });
}

/**
 * Look up the client phone for an order.
 * Phone lives on Order.clientPhone (captured at the puerta). Fallback to
 * DocumentAnalysis.clientPhone for older orders that predate that capture.
 */
export async function getOrderPhone(orderId: string): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { clientPhone: true },
  });
  if (order?.clientPhone) return order.clientPhone;

  const doc = await prisma.documentAnalysis.findFirst({
    where: { orderId, clientPhone: { not: null } },
    select: { clientPhone: true },
  });
  return doc?.clientPhone || null;
}

/**
 * Push directo al staff (Juan) por SMS. No depende del email (pasivo, se mezcla
 * con el correo) ni del digest diario. Canal SMS forzado — no usa WhatsApp para
 * no depender de plantillas business-initiated. Fire-and-forget.
 */
async function sendStaffSMS(body: string, context: string): Promise<void> {
  const staff = process.env.STAFF_PHONE;
  let res: { ok: boolean; id?: string; error?: string };
  if (!staff) {
    console.error(`[staff-sms] STAFF_PHONE no configurado — aviso "${context}" no enviado`);
    res = { ok: false, error: "STAFF_PHONE no configurado" };
  } else {
    res = await sendSMS({ to: formatPhoneSpain(staff), body, channel: "sms" }).catch((e) => ({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
  if (!res.ok) console.error(`[staff-sms] fallo enviando aviso "${context}"`, res.error);

  // Rastro + red (25-ago-2026, caso 26_34F612: el SMS de PAGO se perdió en silencio
  // y Juan se enteró del pedido por lavori). Si el contexto nombra un pedido, el
  // intento queda en su ficha con SID/estado; y si Twilio falla, el mismo texto
  // va por email a staff — dos transportes, nunca una pérdida muda.
  const ref = context.match(/\b(\d{2}_[A-Z0-9]{6}|TJ-\d{8}-[A-Z0-9]+)\b/)?.[1];
  if (ref) {
    await prisma.orderEvent
      .create({
        data: {
          order: { connect: { reference: ref } },
          type: res.ok ? "staff.sms_sent" : "staff.sms_failed",
          message: `SMS a staff ${res.ok ? "enviado" : "FALLIDO"} (${context})${res.id ? ` · SID ${res.id}` : ""}${res.error ? ` · ${String(res.error).slice(0, 160)}` : ""}`,
          payload: { context, ok: res.ok, sid: res.id ?? null, error: res.error ?? null, body },
        },
      })
      .catch(() => {});
  }
  if (!res.ok) {
    const { sendMail } = await import("@/lib/azure-mail");
    await sendMail({
      to: process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net",
      subject: `[SMS no enviado] ${body.slice(0, 80)}`,
      text: `${body}\n\nEl SMS a staff no salió (${context}): ${res.error || "sin detalle"}.`,
      html: `<p>${body}</p><p>El SMS a staff no salió (${context}): ${res.error || "sin detalle"}.</p>`,
    }).catch((e) => console.error("[staff-sms] fallback email failed", e));
  }
}

// Aviso genérico al staff (fire-and-forget). Para hitos sin plantilla propia.
export async function sendStaffAlertSMS(body: string, context: string): Promise<void> {
  return sendStaffSMS(body, context);
}

// Aviso INMEDIATO al staff cuando entra un pago.
export async function sendStaffNewOrderSMS(data: {
  reference: string;
  amountCents: number;
  langPair?: string | null;
  via: string;
}): Promise<void> {
  const amount = (data.amountCents / 100).toFixed(2);
  const lang = data.langPair ? ` ${data.langPair}` : "";
  const body = `PAGO ${amount} EUR - pedido ${data.reference}${lang} (${data.via}). Tramitar: traduccionesjuradas.net/zona-traductor`;
  await sendStaffSMS(body, `pago ${data.reference}`);
}

// Aviso al staff cuando un colaborador envía su cotización → enlace al panel
// del pedido para revisar las ofertas y adjudicar.
export async function sendStaffQuoteSMS(data: {
  reference: string;
  collaboratorName: string;
  priceCents: number;
}): Promise<void> {
  const amount = (data.priceCents / 100).toFixed(2);
  const body = `COTIZACION ${amount} EUR de ${data.collaboratorName} - pedido ${data.reference}. Adjudica: traduccionesjuradas.net/zona-traductor/pedido/${encodeURIComponent(data.reference)}`;
  await sendStaffSMS(body, `cotizacion ${data.reference}`);
}

export function formatPhoneSpain(phone: string): string {
  let clean = phone.replace(/[\s\-().]/g, "");
  if (clean.startsWith("00")) clean = "+" + clean.slice(2);
  if (clean.startsWith("34") && !clean.startsWith("+")) clean = "+" + clean;
  if (/^[679]/.test(clean)) clean = "+34" + clean;
  return clean;
}
