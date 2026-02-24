import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeSessionPricing } from "@/lib/session-pricing";
import { getSessionIdFromRequest } from "@/lib/session";
import { serializeOrderSession } from "@/lib/session-dto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Sesion no encontrada." }, { status: 401 });
  }

  try {
    const docsCount = await prisma.orderDocument.count({ where: { sessionId } });
    if (docsCount < 1) {
      return NextResponse.json(
        { ok: false, error: "Sube al menos un documento original antes del checkout." },
        { status: 400 }
      );
    }

    const pricing = await computeSessionPricing(sessionId);
    const session = await prisma.orderSession.update({
      where: { id: sessionId },
      data: {
        step: "CHECKOUT",
        subtotalCents: pricing.subtotalCents,
        vatCents: pricing.vatCents,
        totalCents: pricing.totalCents,
        currency: pricing.currency,
      },
      include: {
        docs: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({ ok: true, session: serializeOrderSession(session) });
  } catch (err: any) {
    console.error("[session/proceed-checkout] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo avanzar al checkout." },
      { status: 500 }
    );
  }
}
