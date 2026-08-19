// Ajuste IA genérico de un borrador de email al cliente. Lo usan el compositor
// del pedido (ClientMessageComposer) y el preview editable del presupuesto:
// recibe el borrador actual + instrucción (+ opcionalmente el mensaje del
// cliente pegado) y devuelve la versión reescrita. NO envía nada.

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { buildBusinessContext, generateEmailDraft } from "@/lib/ai/email-reply";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const rate = await checkRateLimit({
    key: `email-draft:${getClientIp(req)}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, error: `Demasiadas peticiones. Espera ${rate.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const currentSubject = String(body?.subject || "").trim();
    const currentBody = String(body?.body || "").trim();
    const instruction = String(body?.instruction || "").trim();
    const clientMessage = String(body?.clientMessage || "").trim();
    const quoteId = String(body?.quoteId || "").trim() || null;
    const orderReference = String(body?.orderReference || "").trim() || null;

    if (!currentBody && !clientMessage) {
      return NextResponse.json(
        { ok: false, error: "No hay borrador ni mensaje del cliente que trabajar." },
        { status: 400 }
      );
    }

    const businessContext = await buildBusinessContext({ quoteId, orderReference });

    const draft = await generateEmailDraft({
      mode: currentBody ? "improve" : "reply",
      currentSubject,
      currentBody,
      instruction,
      clientMessage: clientMessage ? { body: clientMessage } : undefined,
      businessContext,
    });

    return NextResponse.json({ ok: true, draft });
  } catch (err: any) {
    console.error("[email-draft] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo generar el borrador." },
      { status: 500 }
    );
  }
}
