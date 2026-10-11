import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Veredicto de Juan sobre un desacuerdo guarda↔resolver (modo sombra del caso): solo
// deja rastro (CasoEvento "veredicto", uno por comparación; repetir lo sustituye).
const VEREDICTOS = ["resolver", "guarda"] as const;

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  const rl = await checkRateLimit({ key: `caso-veredicto:${access.email}:${getClientIp(req)}`, limit: 120, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Demasiadas operaciones." }, { status: 429 });

  const body = (await req.json().catch(() => null)) as { eventoId?: string; veredicto?: string } | null;
  const veredicto = String(body?.veredicto || "");
  if (!body?.eventoId || !(VEREDICTOS as readonly string[]).includes(veredicto)) {
    return NextResponse.json({ ok: false, error: "Veredicto no válido." }, { status: 400 });
  }
  const evento = await prisma.casoEvento.findUnique({ where: { id: String(body.eventoId) }, select: { id: true, tipo: true, casoId: true } });
  if (!evento || evento.tipo !== "comparacion") return NextResponse.json({ ok: false, error: "Comparación no encontrada." }, { status: 404 });

  try {
    await prisma.$transaction([
      prisma.casoEvento.deleteMany({ where: { tipo: "veredicto", dedupeKey: evento.id } }),
      prisma.casoEvento.create({
        data: { casoId: evento.casoId, tipo: "veredicto", dedupeKey: evento.id, actor: access.email || "staff", payload: { eventoId: evento.id, veredicto } },
      }),
    ]);
  } catch (err: any) {
    // Doble clic simultáneo: el otro ya dejó el veredicto.
    if (err?.code !== "P2002") throw err;
  }
  return NextResponse.json({ ok: true });
}
