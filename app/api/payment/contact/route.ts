import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionIdFromRequest } from "@/lib/session";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { formatPhoneSpain } from "@/lib/sms";

export const runtime = "nodejs";

/* Guarda el móvil (opcional) del cliente en OrderSession.clientPhone desde el
   checkout del funnel. Se llama al rellenar el campo (onBlur), no al pagar, para
   que el teléfono quede en la sesión sea cual sea la vía (tarjeta o manual): el
   webhook de Stripe y createOrderFromSession ya lo propagan a Order.clientPhone,
   que es lo que lee getOrderPhone para el SMS de hitos. Cadena vacía lo limpia. */

export async function POST(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Sesion no encontrada." }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `payment-contact:${sessionId}:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { phone?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo no valido." }, { status: 400 });
  }

  const raw = typeof body.phone === "string" ? body.phone.trim() : "";
  let phone: string | null = null;
  if (raw) {
    const formatted = formatPhoneSpain(raw);
    const digits = formatted.replace(/\D/g, "");
    if (digits.length < 9 || digits.length > 15) {
      return NextResponse.json({ ok: false, error: "Telefono no valido." }, { status: 400 });
    }
    phone = formatted;
  }

  try {
    await prisma.orderSession.update({
      where: { id: sessionId },
      data: { clientPhone: phone },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo guardar." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, phone });
}
