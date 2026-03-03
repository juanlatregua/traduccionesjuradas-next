import { NextResponse } from "next/server";
import { sendSMS, sendNotification, formatPhoneSpain } from "@/lib/sms";

// Temporal — eliminar tras probar
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phone = formatPhoneSpain("+34607356273");
  const body = "Test desde TraduccionesJuradas.net - Si recibes esto, las notificaciones funcionan correctamente.";

  // Test 1: SMS directo
  const smsResult = await sendSMS({ to: phone, body, channel: "sms" });

  // Test 2: WhatsApp (si configurado)
  const waResult = await sendNotification({ to: phone, body });

  return NextResponse.json({
    phone,
    sms: smsResult,
    whatsapp: waResult,
    provider: process.env.SMS_PROVIDER || "log",
    hasTwilioKeys: Boolean(process.env.TWILIO_API_KEY_SID),
    hasWhatsApp: Boolean(process.env.TWILIO_WHATSAPP_FROM),
  });
}
