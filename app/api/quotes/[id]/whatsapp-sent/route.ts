import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = {
  params: {
    id: string;
  };
};

// Al pulsar "WhatsApp al cliente" en la ficha, el borrador pasa a SENT: hasta
// hoy había 135 DRAFT_WHATSAPP y 0 enviados en BD, imposible distinguir "Juan
// lo mandó" de "nadie lo mandó" (medida 3 de la auditoría del funnel 24-ago).
export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    select: { id: true, customerPhone: true, customerEmail: true },
  });
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as { body?: string } | null;
  const text = String(body?.body || "").trim().slice(0, 4000);

  const draft = await prisma.messageLog.findFirst({
    // Solo el borrador del pay-link: sin el type, el clic podía flippear un
    // REMINDER legacy (y el cron daría el recordatorio por hecho) o una oferta
    // TRANSLATOR_REVIEW_OFFER de capture-leads.
    where: { quoteId: quote.id, channel: "WHATSAPP", type: "DRAFT_WHATSAPP", status: "DRAFT" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const now = new Date();
  if (draft) {
    await prisma.messageLog.update({
      where: { id: draft.id },
      data: { status: "SENT", sentAt: now, ...(text ? { body: text } : {}) },
    });
  } else {
    await prisma.messageLog.create({
      data: {
        quoteId: quote.id,
        channel: "WHATSAPP",
        type: "DRAFT_WHATSAPP",
        recipient: quote.customerPhone || quote.customerEmail,
        body: text || "(enviado a mano por WhatsApp)",
        sentAt: now,
        status: "SENT",
      },
    });
  }

  return NextResponse.json({ ok: true });
}
