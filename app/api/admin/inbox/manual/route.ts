// Alta MANUAL de un WhatsApp en la bandeja (mientras no hay sender de API:
// el cliente escribe al WhatsApp de empresa del movil y el staff lo trae aqui
// para tener lectura IA, expediente/presupuesto y borrador de respuesta).
// Los archivos ya estan en Blob (subida cliente via /api/documents/upload).
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { matchClientContext } from "@/lib/inbox";
import { whatsappLocalEmail } from "@/lib/twilio-signature";

export const runtime = "nodejs";

function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = `+${d.slice(2)}`;
  if (!d.startsWith("+")) {
    const digits = d.replace(/\D/g, "");
    d = digits.length === 9 ? `+34${digits}` : `+${digits}`;
  }
  const digits = d.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15 ? `+${digits}` : null;
}

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  const phone = normalizePhone(String(body?.phone || ""));
  if (!phone) return NextResponse.json({ ok: false, error: "Teléfono no válido (p. ej. +34600123456)." }, { status: 400 });
  const name = String(body?.name || "").trim().slice(0, 120) || null;
  const text = String(body?.text || "").trim().slice(0, 20000);
  const media = Array.isArray(body?.media)
    ? body.media
        .filter((m: any) => m?.url && m?.contentType)
        .slice(0, 20)
        .map((m: any) => ({
          url: String(m.url),
          contentType: String(m.contentType).toLowerCase(),
          name: String(m.name || "adjunto").slice(0, 200),
          size: Number(m.size) || 0,
        }))
    : [];
  if (!text && media.length === 0) {
    return NextResponse.json({ ok: false, error: "Pega el texto del WhatsApp o adjunta algún archivo." }, { status: 400 });
  }
  const receivedAt = body?.receivedAt ? new Date(String(body.receivedAt)) : new Date();
  const fromEmail = whatsappLocalEmail(phone);
  const match = await matchClientContext(fromEmail, phone);
  const subject =
    text.split(/\n/)[0]?.slice(0, 90) || `WhatsApp con ${media.length} archivo${media.length === 1 ? "" : "s"}`;
  const row = await prisma.inboundEmail.create({
    data: {
      graphId: `manual:${randomUUID()}`,
      channel: "WHATSAPP",
      fromEmail,
      fromPhone: phone,
      fromName: name,
      subject,
      bodyPreview: (text || `[${media.length} archivo(s) adjunto(s)]`).slice(0, 500),
      bodyText: text || null,
      mediaJson: media.length ? media : undefined,
      receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
      customerId: match.customerId,
      quoteId: match.quoteId,
      orderReference: match.orderReference,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: row.id });
}
