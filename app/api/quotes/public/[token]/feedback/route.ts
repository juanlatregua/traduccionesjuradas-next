import { NextResponse } from "next/server";
import { QuoteLostReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Params = {
  params: {
    token: string;
  };
};

const REASONS = Object.values(QuoteLostReason);

export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `quote-feedback:${params.token}:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const reason = String(body?.reason || "").toUpperCase() as QuoteLostReason;
  if (!REASONS.includes(reason)) {
    return NextResponse.json({ ok: false, error: "Motivo no válido." }, { status: 400 });
  }
  const note = String(body?.note || "").trim().slice(0, 500) || null;

  const quote = await prisma.quote.findUnique({
    where: { publicToken: params.token },
    select: {
      id: true,
      status: true,
      paidAt: true,
      orders: {
        where: { paymentStatus: "PAID" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  }

  // Un presupuesto formalizado (pagado directamente o convertido en pedido pagado)
  // nunca debe registrar un "por qué no seguiste": sería el peor bug de esta feature.
  const converted =
    quote.paidAt != null ||
    quote.orders.length > 0 ||
    ["PAID", "IN_PROGRESS", "DELIVERED"].includes(quote.status);
  if (converted) {
    return NextResponse.json(
      { ok: false, error: "Este presupuesto ya se formalizó; no hay nada que registrar." },
      { status: 400 }
    );
  }

  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      lostReason: reason,
      lostReasonNote: note,
      lostFeedbackAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
