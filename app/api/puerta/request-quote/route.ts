// app/api/puerta/request-quote/route.ts
// "Solicitar presupuesto" desde la puerta (24-ago-2026). La lógica de enrutado
// (staff email+SMS, tarifario, carril lavori, acuse al cliente) vive en
// lib/puerta-request-quote.ts, compartida con el enlace «revisar a mano».

import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { routePuertaQuoteRequest } from "@/lib/puerta-request-quote";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `puerta-request-quote:${ip}`,
    limit: 10,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Demasiadas peticiones." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const token = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Sesión no válida." }, { status: 400 });
  }
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  const locale = typeof body?.lang === "string" ? body.lang.trim().slice(0, 5) : null;

  const r = await routePuertaQuoteRequest({ sessionToken: token, email, phone, locale });
  return NextResponse.json(r.body, { status: r.status });
}
