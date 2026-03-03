import { NextResponse } from "next/server";
import { sendSMS, formatPhoneSpain } from "@/lib/sms";

// Temporal — eliminar tras probar
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phone = formatPhoneSpain("+34607356273");
  const body = "Test desde TraduccionesJuradas.net - Si recibes esto, las notificaciones funcionan correctamente.";

  // Diagnóstico de credenciales
  const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  const apiKeySid = process.env.TWILIO_API_KEY_SID || "";
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  const fromNumber = process.env.TWILIO_FROM_NUMBER || "";
  const waFrom = process.env.TWILIO_WHATSAPP_FROM || "";

  const diag = {
    accountSid: accountSid ? `${accountSid.slice(0, 6)}...${accountSid.slice(-4)}` : "NOT SET",
    apiKeySid: apiKeySid ? `${apiKeySid.slice(0, 6)}...${apiKeySid.slice(-4)}` : "NOT SET",
    apiKeySecret: apiKeySecret ? `${apiKeySecret.length} chars, starts ${apiKeySecret.slice(0, 3)}...` : "NOT SET",
    authToken: authToken ? `${authToken.length} chars, starts ${authToken.slice(0, 3)}...` : "NOT SET",
    fromNumber,
    waFrom: waFrom || "NOT SET",
    provider: process.env.SMS_PROVIDER || "log",
  };

  // Test SMS
  const smsResult = await sendSMS({ to: phone, body, channel: "sms" });

  return NextResponse.json({ phone, diag, smsResult });
}
