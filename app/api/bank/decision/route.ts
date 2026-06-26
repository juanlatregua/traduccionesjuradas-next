// app/api/bank/decision/route.ts — STAFF ADMIN/PM: persiste SOLO la decisión sobre
// una línea bancaria (ignorar / emparejar a mano) por hash. Sin datos del extracto.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { setInvoicePaid } from "@/lib/client-invoice";

export const runtime = "nodejs";

type Body = {
  lineHash?: string;
  status?: "IGNORED" | "MATCHED_MANUAL";
  matchedType?: string | null;
  matchedId?: string | null;
  note?: string | null;
  brand?: string | null;
  movementDate?: string | null; // fecha del movimiento → sella paidAt en factura/gasto
};

// Sella (o limpia) el cobro/pago en la factura/gasto vinculado. La factura pasa
// por el helper único setInvoicePaid (misma guarda que el marcado manual). No se
// traga el fallo: devuelve un aviso para que el panel lo muestre (p.ej. factura
// aún en borrador → no se puede sellar como cobrada).
async function setPaid(
  matchedType: string | null | undefined,
  matchedId: string | null | undefined,
  when: Date | null
): Promise<{ ok: boolean; warning?: string }> {
  try {
    if (matchedType === "invoice" && matchedId) {
      await setInvoicePaid(matchedId, when);
    } else if (matchedType === "expense" && matchedId) {
      await prisma.expense.update({ where: { id: matchedId }, data: { paidAt: when, paymentStatus: when ? "PAID" : "PENDING" } });
    }
    return { ok: true };
  } catch (err: any) {
    console.error("[bank-decision] setPaid failed", matchedType, matchedId, err);
    return { ok: false, warning: err?.message || "No se pudo sellar el cobro." };
  }
}

async function gate(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return { ok: false as const, status: 403, error: access.error };
  const role = getStaffRole(access.email);
  if (role !== "ADMIN" && role !== "PM") return { ok: false as const, status: 403, error: "Solo ADMIN/PM." };
  return { ok: true as const };
}

export async function POST(req: Request) {
  const g = await gate(req);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* opcional */
  }
  const lineHash = String(body.lineHash || "").trim();
  if (!lineHash) return NextResponse.json({ ok: false, error: "Falta lineHash." }, { status: 400 });
  const status = body.status === "MATCHED_MANUAL" ? "MATCHED_MANUAL" : "IGNORED";

  const data = {
    status,
    matchedType: status === "MATCHED_MANUAL" ? body.matchedType || null : null,
    matchedId: status === "MATCHED_MANUAL" ? body.matchedId || null : null,
    note: body.note?.trim() || null,
    brand: body.brand?.trim() || "traduccionesjuradas",
  };
  const decision = await prisma.bankDecision.upsert({
    where: { lineHash },
    create: { lineHash, ...data },
    update: data,
  });

  // Marcar cobrado/pagado al vincular; limpiar si la decisión deja de ser un emparejamiento.
  if (status === "MATCHED_MANUAL") {
    const when = body.movementDate && !isNaN(new Date(body.movementDate).getTime()) ? new Date(body.movementDate) : new Date();
    const sealed = await setPaid(data.matchedType, data.matchedId, when);
    if (!sealed.ok) {
      return NextResponse.json({ ok: true, decision, warning: sealed.warning });
    }
  }
  return NextResponse.json({ ok: true, decision });
}

export async function DELETE(req: Request) {
  const g = await gate(req);
  if (!g.ok) return NextResponse.json({ ok: false, error: g.error }, { status: g.status });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* opcional */
  }
  const lineHash = String(body.lineHash || "").trim();
  if (!lineHash) return NextResponse.json({ ok: false, error: "Falta lineHash." }, { status: 400 });
  const prev = await prisma.bankDecision.findUnique({ where: { lineHash }, select: { matchedType: true, matchedId: true } });
  await prisma.bankDecision.deleteMany({ where: { lineHash } });
  // Si deshacemos un emparejamiento manual, quitamos el sello de cobrado/pagado.
  if (prev) await setPaid(prev.matchedType, prev.matchedId, null);
  return NextResponse.json({ ok: true });
}
