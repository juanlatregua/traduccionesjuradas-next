// Archiva / desarchiva un email de la bandeja (solo en la app, no toca Graph).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  try {
    const inbound = await prisma.inboundEmail.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, repliedAt: true },
    });
    if (!inbound) {
      return NextResponse.json({ ok: false, error: "Email no encontrado." }, { status: 404 });
    }

    const next =
      inbound.status === "ARCHIVED"
        ? inbound.repliedAt
          ? ("REPLIED" as const)
          : ("NEW" as const)
        : ("ARCHIVED" as const);

    await prisma.inboundEmail.update({ where: { id: inbound.id }, data: { status: next } });
    return NextResponse.json({ ok: true, status: next });
  } catch (err: any) {
    console.error("[inbox:archive] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo archivar." },
      { status: 500 }
    );
  }
}
