// app/api/area-cliente/request-access/route.ts
// El cliente pide acceso por email → si tiene algún pedido/presupuesto, le
// enviamos un magic-link a su zona. Respuesta SIEMPRE genérica (no revelamos si
// el email existe). Rate-limit por IP y por email (anti-spam de enlaces).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { buildClientPortalUrl } from "@/lib/client-token";
import { sendClientAccessLinkEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({ key: `client-access:${ip}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes. Inténtalo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { email?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Indica un email válido." }, { status: 400 });
  }

  // Límite por email: no más de 3 enlaces/hora (evita usarlo para bombardear).
  const rlEmail = await checkRateLimit({ key: `client-access:email:${email}`, limit: 3, windowMs: 60 * 60 * 1000 });
  if (rlEmail.ok) {
    // Solo enviamos si el email tiene algo asociado (case-insensitive). NO lo revelamos.
    const ci = { equals: email, mode: "insensitive" as const };
    const [hasOrder, hasQuote] = await Promise.all([
      prisma.order.findFirst({ where: { clientEmail: ci }, select: { id: true } }),
      prisma.quote.findFirst({ where: { customerEmail: ci }, select: { id: true } }),
    ]);
    if (hasOrder || hasQuote) {
      const url = buildClientPortalUrl(email);
      sendClientAccessLinkEmail({ toEmail: email, url }).catch((e) =>
        console.error("[client-access] email failed", e)
      );
    }
  }

  // Respuesta genérica SIEMPRE (no filtra existencia del email).
  return NextResponse.json({ ok: true });
}
