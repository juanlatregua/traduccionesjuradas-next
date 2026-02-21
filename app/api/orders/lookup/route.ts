import { NextResponse } from "next/server";
import { getOrderLookupByReferenceAndEmail } from "@/lib/orders";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

type LookupBody = {
  reference?: string;
  email?: string;
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `orders:lookup:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas consultas. Intentalo de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await req.json()) as LookupBody;
    const reference = String(body.reference || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (!reference || !email) {
      return NextResponse.json({ ok: false, error: "Referencia y email son obligatorios." }, { status: 400 });
    }

    const order = await getOrderLookupByReferenceAndEmail(reference, email);
    if (!order) {
      // Mensaje generico para no revelar combinaciones validas.
      return NextResponse.json({ ok: false, error: "No se ha encontrado el pedido." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, order });
  } catch (err) {
    console.error("[orders/lookup] error", err);
    return NextResponse.json({ ok: false, error: "Error al consultar pedido." }, { status: 500 });
  }
}
