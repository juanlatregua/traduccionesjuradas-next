// app/api/admin/tax-close/route.ts — Cierre de trimestre de IVA (TaxPeriodClose).
// POST { period: "2026-T2" } → marca el trimestre como presentado (las emisiones
// en lote ya no fecharán cobros dentro de él). DELETE { period } → reabrir.
// Solo staff (mismo gate que gestoria-package).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { parseTaxPeriod, isClosableTaxPeriod } from "@/lib/tax-close";

export const runtime = "nodejs";

async function readPeriod(req: Request): Promise<string | null> {
  try {
    const body = await req.json();
    const period = typeof body?.period === "string" ? body.period.trim() : "";
    return parseTaxPeriod(period) ? period : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const period = await readPeriod(req);
  if (!period) {
    return NextResponse.json({ ok: false, error: "Periodo inválido: usa el formato YYYY-TN (p. ej. 2026-T2)." }, { status: 400 });
  }
  if (!isClosableTaxPeriod(period)) {
    return NextResponse.json({ ok: false, error: "Solo se puede cerrar un trimestre ya terminado." }, { status: 400 });
  }

  const close = await prisma.taxPeriodClose.upsert({
    where: { period },
    create: { period, closedBy: access.email },
    update: { closedBy: access.email, closedAt: new Date() },
  });
  return NextResponse.json({ ok: true, period: close.period, closedAt: close.closedAt.toISOString() });
}

export async function DELETE(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const period = await readPeriod(req);
  if (!period) {
    return NextResponse.json({ ok: false, error: "Periodo inválido: usa el formato YYYY-TN (p. ej. 2026-T2)." }, { status: 400 });
  }

  await prisma.taxPeriodClose.deleteMany({ where: { period } });
  return NextResponse.json({ ok: true, period });
}
