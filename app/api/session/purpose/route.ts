import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionIdFromRequest } from "@/lib/session";
import { serializeOrderSession } from "@/lib/session-dto";
import { computeSessionPricing } from "@/lib/session-pricing";

export const runtime = "nodejs";

type PurposeBody = {
  purpose?: string;
};

export async function POST(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Sesion no encontrada." }, { status: 401 });
  }

  let body: PurposeBody = {};
  try {
    body = (await req.json()) as PurposeBody;
  } catch {
    body = {};
  }

  try {
    await prisma.orderSession.update({
      where: { id: sessionId },
      data: {
        purpose: String(body.purpose || "").trim() || null,
        step: "UPLOAD",
      },
    });

    const pricing = await computeSessionPricing(sessionId);
    const session = await prisma.orderSession.update({
      where: { id: sessionId },
      data: {
        subtotalCents: pricing.subtotalCents,
        vatCents: pricing.vatCents,
        totalCents: pricing.totalCents,
      },
      include: { docs: { orderBy: { createdAt: "desc" } } },
    });
    return NextResponse.json({ ok: true, session: serializeOrderSession(session) });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo actualizar el proposito." },
      { status: 500 }
    );
  }
}
