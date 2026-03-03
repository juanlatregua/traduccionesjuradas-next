// lib/sms.ts — Abstracción SMS + WhatsApp via Twilio

import { prisma } from "@/lib/prisma";

export type SMSMessage = {
  to: string; // formato E.164: +34600123456
  body: string;
  channel?: "sms" | "whatsapp";
};

/**
 * Twilio auth: soporta API Key (TWILIO_API_KEY_SID + SECRET) o Auth Token.
 */
function getTwilioAuth(): { user: string; pass: string } {
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  if (apiKeySid && apiKeySecret) {
    return { user: apiKeySid, pass: apiKeySecret };
  }
  return {
    user: process.env.TWILIO_ACCOUNT_SID!,
    pass: process.env.TWILIO_AUTH_TOKEN!,
  };
}

async function twilioSend(
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
  return sendSMS({ ...msg, channel: hasWhatsApp ? "whatsapp" : "sms" });
}

/**
 * Look up the client phone for an order.
 * Phone lives on DocumentAnalysis (IA flow) — Order itself doesn't store phone.
 */
export async function getOrderPhone(orderId: string): Promise<string | null> {
  const doc = await prisma.documentAnalysis.findFirst({
    where: { orderId, clientPhone: { not: null } },
    select: { clientPhone: true },
  });
  return doc?.clientPhone || null;
}

export function formatPhoneSpain(phone: string): string {
  let clean = phone.replace(/[\s\-().]/g, "");
  if (clean.startsWith("00")) clean = "+" + clean.slice(2);
  if (clean.startsWith("34") && !clean.startsWith("+")) clean = "+" + clean;
  if (/^[679]/.test(clean)) clean = "+34" + clean;
  return clean;
}
