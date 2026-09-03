// app/api/quotes/[id]/authorize-credit/route.ts — STAFF ADMIN/PM: crea el pedido
// del presupuesto SIN cobro y lo autoriza a crédito (factura con vencimiento).
// Mismo gate que /api/orders/[reference]/credit: comprometer dinero futuro pide
// más que constatar un cobro (ADMIN/PM, rate limit, motivo, confirm:true).

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { CreditError } from "@/lib/credit";
import { authorizeQuoteCredit } from "@/lib/quote-credit";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const role = getStaffRole(access.email);
  if (role !== "ADMIN" && role !== "PM") {
    return NextResponse.json({ ok: false, error: "Solo ADMIN/PM puede autorizar a crédito." }, { status: 403 });
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

  let body: { reason?: string; dueDate?: string; confirm?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  if (body.confirm !== true) {
    return NextResponse.json({ ok: false, error: "Falta confirm:true — esto compromete un cobro futuro." }, { status: 400 });
  }

  try {
    const r = await authorizeQuoteCredit({
      quoteId: params.id,
      actorEmail: access.email,
      reason: String(body.reason || ""),
      dueDate: body.dueDate || null,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (err: any) {
    if (err instanceof CreditError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("[quotes:authorize-credit] error", err?.message || err);
    return NextResponse.json({ ok: false, error: "No se pudo autorizar el crédito." }, { status: 500 });
  }
}
