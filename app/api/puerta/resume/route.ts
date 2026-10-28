// app/api/puerta/resume/route.ts — «Continuar con mi pedido» del email del
// presupuesto automático: con el token firmado devuelve ESE documento analizado
// para que la puerta lo muestre listo para pagar (teléfono, plazo, pago). El
// precio lo recalcula la puerta y lo vuelve a validar /api/puerta/checkout.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyResumeToken } from "@/lib/puerta-resume-token";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({ key: `puerta-resume:${ip}`, limit: 30, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Demasiadas peticiones." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const parsed = verifyResumeToken(process.env.NEXTAUTH_SECRET || "", typeof body?.token === "string" ? body.token : null);
  if (!parsed) return NextResponse.json({ ok: false, error: "Enlace no válido o caducado." }, { status: 400 });

  try {
    const doc = await prisma.documentAnalysis.findFirst({
      where: { id: parsed.documentId, sessionToken: parsed.sessionToken },
      select: { id: true, fileName: true, analysisJson: true, clientEmail: true, orderId: true },
    });
    if (!doc?.analysisJson) return NextResponse.json({ ok: false, error: "El documento ya no está disponible." }, { status: 404 });
    if (doc.orderId) return NextResponse.json({ ok: false, paid: true, error: "Este pedido ya está pagado." }, { status: 409 });
    return NextResponse.json({
      ok: true,
      sessionToken: parsed.sessionToken,
      email: doc.clientEmail || "",
      document: { id: doc.id, fileName: doc.fileName, analysis: doc.analysisJson },
    });
  } catch (err: any) {
    console.error("[puerta:resume]", err?.message || err);
    return NextResponse.json({ ok: false, error: "No se pudo recuperar el presupuesto." }, { status: 500 });
  }
}
