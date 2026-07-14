import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Body = {
  references?: string[];
};

const MAX_REFS = 50;

export async function POST(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  const role = getStaffRole(staff.email);
  if (role !== "ADMIN" && role !== "PM") {
    return NextResponse.json(
      { ok: false, error: "Solo ADMIN/PM puede eliminar pedidos." },
      { status: 403 }
    );
  }

  const clientIp = getClientIp(req);
  const rl = await checkRateLimit({
    key: `${clientIp}:bulk-delete`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const refs = body.references;

    if (!Array.isArray(refs) || refs.length === 0) {
      return NextResponse.json({ ok: false, error: "Falta array de referencias." }, { status: 400 });
    }

    if (refs.length > MAX_REFS) {
      return NextResponse.json(
        { ok: false, error: `Máximo ${MAX_REFS} referencias por operación.` },
        { status: 400 }
      );
    }

    const cleanRefs = refs.map((r) => String(r).trim()).filter(Boolean);
    if (cleanRefs.length === 0) {
      return NextResponse.json({ ok: false, error: "Referencias vacías." }, { status: 400 });
    }

    // Con onDelete SetNull: limpiar borradores/presupuestos vinculados (las
    // facturas EMITIDAS se conservan huérfanas a propósito, son inmutables).
    await prisma.clientInvoice.deleteMany({
      where: {
        order: { reference: { in: cleanRefs } },
        OR: [{ status: "DRAFT" }, { docKind: "quote" }],
      },
    });
    const result = await prisma.order.deleteMany({
      where: { reference: { in: cleanRefs } },
    });

    console.warn("[orders-bulk-delete] bulk removed", {
      count: result.count,
      references: cleanRefs,
      actorEmail: staff.email,
      role,
      at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (err: any) {
    console.error("[orders-bulk-delete] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudieron eliminar los pedidos." },
      { status: 500 }
    );
  }
}
