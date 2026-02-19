import { NextResponse } from "next/server";

export async function GET() {
  const gvJson = process.env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON || "";
  const ocrKey = process.env.OCR_SPACE_API_KEY || "";
  const staffEmails = process.env.STAFF_EMAILS || "";

  let gvStatus = "no configurada";
  if (gvJson) {
    let raw = gvJson;
    if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
    try {
      const parsed = JSON.parse(raw);
      if (parsed.client_email && parsed.private_key) {
        gvStatus = `OK (client_email: ${parsed.client_email})`;
      } else {
        gvStatus = `JSON parseado pero faltan campos: client_email=${!!parsed.client_email}, private_key=${!!parsed.private_key}`;
      }
    } catch (err) {
      gvStatus = `Error de parseo: ${(err as Error).message}. Primeros 60 chars: ${gvJson.slice(0, 60)}`;
    }
  }

  return NextResponse.json({
    GOOGLE_VISION_SERVICE_ACCOUNT_JSON: gvStatus,
    OCR_SPACE_API_KEY: ocrKey ? `OK (${ocrKey.slice(0, 4)}...)` : "no configurada",
    STAFF_EMAILS: staffEmails || "no configurada",
  });
}
