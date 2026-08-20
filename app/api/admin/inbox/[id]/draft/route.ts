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
    });

    const draft = await generateEmailDraft({
      mode: "reply",
      clientMessage: {
        fromName: inbound.fromName,
        fromEmail: inbound.fromEmail,
        subject: inbound.subject,
        body: inbound.bodyText || inbound.bodyPreview,
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
