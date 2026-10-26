// app/api/puerta/deadline/route.ts — el cliente cambia «¿Para cuándo lo necesitas?»
// después de subir: se actualiza en su sesión (propiedad por sessionToken) y su caso.

import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { parseDeadline } from "@/lib/needed-by";
import { saveSessionDeadline } from "@/lib/needed-by-db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({ key: `puerta-deadline:${ip}`, limit: 60, windowMs: 24 * 60 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Demasiadas peticiones." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const token = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
  if (!token || token.startsWith("staff:") || token.startsWith("exp:")) {
    return NextResponse.json({ ok: false, error: "Sesión no válida." }, { status: 400 });
  }
  const deadline = parseDeadline(body?.urgency, body?.neededBy);
  if (!deadline) return NextResponse.json({ ok: false, error: "Fecha no válida." }, { status: 400 });

  try {
    const count = await saveSessionDeadline(token, deadline);
    if (count === 0) return NextResponse.json({ ok: false, error: "Sesión no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[puerta:deadline]", err?.message || err);
    return NextResponse.json({ ok: false, error: "No se pudo guardar la fecha." }, { status: 500 });
  }
}
