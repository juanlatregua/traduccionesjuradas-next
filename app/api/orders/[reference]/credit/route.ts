// app/api/orders/[reference]/credit/route.ts — STAFF ADMIN/PM: autoriza un pedido
// a COBRO APLAZADO (trabajar y entregar antes de cobrar) o retira la autorización.
//
// Gate más estricto que el de mark-paid a propósito: registrar un cobro que YA
// pasó es constatar un hecho; autorizar crédito es comprometer dinero futuro.
// Por eso ADMIN/PM (no requireStaffAccess pelado), rate limit, y motivo obligatorio.
//
// El Quote NO se toca: si se moviera a PAID/IN_PROGRESS, isQuotePayableStatus
// mataría el botón de pagar en /q/[token] y el cliente no podría pagar después.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { authorizeCredit, revokeCredit, CreditError } from "@/lib/credit";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const role = getStaffRole(access.email);
  if (role !== "ADMIN" && role !== "PM") {
    return NextResponse.json(
      { ok: false, error: "Solo ADMIN/PM puede autorizar un pedido a crédito." },
      { status: 403 }
    );
  }

  const rl = await checkRateLimit({
    key: `credit:${access.email}:${getClientIp(req)}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas autorizaciones seguidas." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { action?: string; reason?: string; dueDate?: string; confirm?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const action = String(body.action || "authorize");
  if (action !== "authorize" && action !== "revoke") {
    return NextResponse.json({ ok: false, error: "action debe ser authorize o revoke." }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json(
      { ok: false, error: "Falta confirm:true — esto compromete un cobro futuro." },
      { status: 400 }
    );
  }

  try {
    if (action === "revoke") {
      const r = await revokeCredit({
        reference: params.reference,
        actorEmail: access.email,
        reason: String(body.reason || "").trim(),
      });
      return NextResponse.json({ ok: true, ...r });
    }
    const r = await authorizeCredit({
      reference: params.reference,
      actorEmail: access.email,
      reason: String(body.reason || ""),
      dueDate: body.dueDate || null,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (err: any) {
    if (err instanceof CreditError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("[orders:credit] error", err?.message || err);
    return NextResponse.json({ ok: false, error: "No se pudo autorizar el crédito." }, { status: 500 });
  }
}
