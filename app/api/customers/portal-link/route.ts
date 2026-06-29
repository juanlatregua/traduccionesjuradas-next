// app/api/customers/portal-link/route.ts
// STAFF: genera el enlace de acceso (magic-link) a la zona de un cliente para
// poder ENVIÁRSELO desde la zona traductor (copiar o mandar por email). Reusa
// buildClientPortalUrl + sendClientAccessLinkEmail (mismo magic-link firmado que
// el auto-servicio /area-cliente, sin duplicar la lógica de token).

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { buildClientPortalUrl } from "@/lib/client-token";
import { sendClientAccessLinkEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: { email?: string; send?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Email inválido." }, { status: 400 });
  }

  let url: string;
  try {
    url = buildClientPortalUrl(email);
  } catch (err: any) {
    // Falta ORDER_TOKEN_SECRET en el entorno (p.ej. local sin la var).
    return NextResponse.json({ ok: false, error: "No se pudo generar el enlace (falta configuración del entorno)." }, { status: 503 });
  }

  if (body.send) {
    try {
      await sendClientAccessLinkEmail({ toEmail: email, url });
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: err?.message || "No se pudo enviar el email." }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true, url, sent: !!body.send });
}
