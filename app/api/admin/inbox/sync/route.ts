// Sincroniza la bandeja de entrada del buzón (Graph) → tabla InboundEmail.
// Manual desde /admin/inbox (botón). Requiere Mail.Read en el App Registration.

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isInboxConfigured } from "@/lib/azure-mail-read";
import { syncInboxEmails } from "@/lib/inbox";

export const runtime = "nodejs";
// Bajar adjuntos de los emails nuevos (+ backfill) puede pasar de los 10 s por defecto.
export const maxDuration = 60;

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const rate = await checkRateLimit({
    key: `inbox-sync:${getClientIp(req)}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, error: `Demasiadas sincronizaciones. Espera ${rate.retryAfterSec}s.` },
      { status: 429 }
    );
  }

  if (!isInboxConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Azure no configurado (AZURE_TENANT_ID / CLIENT_ID / CLIENT_SECRET)." },
      { status: 400 }
    );
  }

  try {
    const result = await syncInboxEmails();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[inbox:sync] error", err);
    const msg = String(err?.message || "");
    const hint = /403|ErrorAccessDenied|Access is denied/i.test(msg)
      ? "Graph deniega la lectura: falta conceder el permiso de aplicación Mail.Read (con admin consent) al App Registration de Azure."
      : msg || "No se pudo sincronizar el buzón.";
    return NextResponse.json({ ok: false, error: hint }, { status: 500 });
  }
}
