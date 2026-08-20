// Genera (o regenera) el borrador IA de respuesta a un email entrante y lo
// persiste en InboundEmail.draft* — el staff lo edita y decide si enviarlo.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { buildBusinessContext, generateEmailDraft } from "@/lib/ai/email-reply";
import { rematchInboundIfUnlinked } from "@/lib/inbox";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  try {
    const found = await prisma.inboundEmail.findUnique({ where: { id: params.id } });
    if (!found) {
      return NextResponse.json({ ok: false, error: "Email no encontrado." }, { status: 404 });
    }
    // El presupuesto puede haberse montado DESPUÉS de sincronizar (botón
    // "Montar presupuesto"): re-casa antes de construir el contexto.
    const inbound = await rematchInboundIfUnlinked(found);

    const body = await req.json().catch(() => ({}));
    const instruction = String(body?.instruction || "").trim() || null;

    const businessContext = await buildBusinessContext({
      quoteId: inbound.quoteId,
      orderReference: inbound.orderReference,
      inboundEmailId: inbound.id,
    });

    // Conversación reciente del mismo remitente (72 h): en WhatsApp cada
    // mensaje es una fila y el texto y la foto suelen llegar separados.
    const since = new Date(inbound.receivedAt.getTime() - 72 * 60 * 60 * 1000);
    const siblings = await prisma.inboundEmail.findMany({
      where: { fromEmail: inbound.fromEmail, id: { not: inbound.id }, receivedAt: { gte: since, lte: inbound.receivedAt } },
      orderBy: { receivedAt: "asc" },
      take: 12,
      select: { receivedAt: true, bodyText: true, bodyPreview: true, replyBody: true, repliedAt: true, mediaJson: true },
    });
    const thread = siblings
      .flatMap((m) => {
        const items: { at: Date; who: "cliente" | "nosotros"; text: string }[] = [];
        const nMedia = Array.isArray(m.mediaJson) ? (m.mediaJson as any[]).length : 0;
        const text = (m.bodyText || m.bodyPreview || "").trim() || (nMedia ? `[${nMedia} archivo(s) adjunto(s)]` : "");
        if (text) items.push({ at: m.receivedAt, who: "cliente", text });
        if (m.replyBody && m.repliedAt) items.push({ at: m.repliedAt, who: "nosotros", text: m.replyBody });
        return items;
      })
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .map((t) => ({ ...t, at: t.at.toLocaleString("es-ES") }));
    const media = Array.isArray(inbound.mediaJson)
      ? (inbound.mediaJson as any[])
          .filter((m) => m?.url && m?.contentType)
          .map((m) => ({ url: String(m.url), contentType: String(m.contentType), name: String(m.name || "adjunto") }))
      : [];
    const draft = await generateEmailDraft({
      mode: "reply",
      clientMessage: {
        fromName: inbound.fromName,
        fromEmail: inbound.fromEmail,
        subject: inbound.subject,
        body: inbound.bodyText || (media.length ? "" : inbound.bodyPreview),
        channel: inbound.channel,
        thread,
        media,
      },
      instruction,
      businessContext,
    });

    const updated = await prisma.inboundEmail.update({
      where: { id: inbound.id },
      data: {
        draftSubject: draft.subject,
        draftBody: draft.body,
        draftedAt: new Date(),
        status: inbound.status === "NEW" ? "DRAFTED" : inbound.status,
      },
      select: { status: true },
    });

    return NextResponse.json({ ok: true, draft, status: updated.status });
  } catch (err: any) {
    console.error("[inbox:draft] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo generar el borrador." },
      { status: 500 }
    );
  }
}
