import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionIdFromRequest } from "@/lib/session";
import { serializeOrderSession } from "@/lib/session-dto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Sesion no encontrada." }, { status: 401 });
  }

  try {
    const session = await prisma.orderSession.update({
      where: { id: sessionId },
      data: { step: "START" },
      include: { docs: { orderBy: { createdAt: "desc" } } },
    });
    return NextResponse.json({ ok: true, session: serializeOrderSession(session) });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo preparar la sesion para añadir mas documentos." },
      { status: 500 }
    );
  }
}

