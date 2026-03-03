// lib/sms.ts — Abstracción SMS (Twilio o log en desarrollo)

import { prisma } from "@/lib/prisma";

export type SMSMessage = {
  to: string; // formato E.164: +34600123456
  body: string;
};

export async function sendSMS(
  msg: SMSMessage
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const provider = process.env.SMS_PROVIDER || "log";

  if (provider === "log" || process.env.NODE_ENV === "development") {
    console.log(`[SMS → ${msg.to}] ${msg.body}`);
    return { ok: true, id: `dev-${Date.now()}` };
  }

  if (provider === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_FROM_NUMBER!;

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: msg.to,
          From: from,
          Body: msg.body,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[SMS error]", err);
      return { ok: false, error: err };
    }

    const data = await res.json();
    return { ok: true, id: data.sid };
  }

  return { ok: false, error: `Unknown SMS provider: ${provider}` };
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
