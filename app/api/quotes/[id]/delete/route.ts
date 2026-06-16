// app/api/quotes/[id]/delete/route.ts — STAFF: papelera de presupuestos.
// Soft-delete (mover a "Eliminados") SOLO si NO está formalizado; o restaurar.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

// Formalizado = el cliente pagó / hay trabajo comprometido. No se puede borrar.
const FORMALIZED = ["PAID", "IN_PROGRESS", "DELIVERED"];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: { restore?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }

  const quote = await prisma.quote.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!quote) return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });

  if (body.restore) {
    await prisma.quote.update({ where: { id: params.id }, data: { deletedAt: null } });
    return NextResponse.json({ ok: true, restored: true });
  }

  if (FORMALIZED.includes(quote.status)) {
    return NextResponse.json(
      { ok: false, error: `No se puede eliminar un presupuesto ya formalizado (${quote.status}).` },
      { status: 400 }
    );
  }

  await prisma.quote.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true, deleted: true });
}
