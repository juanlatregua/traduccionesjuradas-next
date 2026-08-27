import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { finalizeAndSendQuote, QuoteSendError } from "@/lib/quote-send";

export const runtime = "nodejs";

type Params = { params: { id: string } };

// Botón «Enviar» del staff. La lógica (PDF + email + WhatsApp + pedidos enlazados)
// vive en lib/quote-send.ts, compartida con el agente de precios (lib/learned-rates).
export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  let skipEmail = false;
  // Copy personalizado desde el preview editable del admin: si llegan subject
  // y body no vacíos sustituyen a la plantilla estándar; si no, todo como antes.
  let customSubject = "";
  let customBody = "";
  try {
    const body = await req.json();
    skipEmail = !!body?.skipEmail;
    customSubject = String(body?.subject || "").trim();
    customBody = String(body?.body || "").trim();
  } catch {
    /* sin body = enviar email como antes */
  }

  try {
    const result = await finalizeAndSendQuote({
      quoteId: params.id,
      actorEmail: access.email,
      skipEmail,
      customSubject,
      customBody,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    if (err instanceof QuoteSendError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("[quotes:finalize-send] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo finalizar y enviar el presupuesto." },
      { status: 500 }
    );
  }
}
