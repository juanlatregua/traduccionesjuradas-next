// app/api/reconcile/orders/issue/route.ts — STAFF ADMIN/PM: emite facturas en lote
// para pedidos cobrados sin factura. Numeración fiscal compartida AA_NNN.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { issueInvoicesForOrders } from "@/lib/reconcile-invoices";

export const runtime = "nodejs";

const MAX_REFS = 200;

type Body = {
  references?: string[];
  dateMode?: "paid" | "today";
  numbersByReference?: Record<string, string>;
};

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const role = getStaffRole(access.email);
  if (role !== "ADMIN" && role !== "PM") {
    return NextResponse.json({ ok: false, error: "Solo ADMIN/PM puede emitir facturas." }, { status: 403 });
  }

  const rl = await checkRateLimit({ key: `reconcile-issue:${access.email}:${getClientIp(req)}`, limit: 10, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Demasiadas emisiones en poco tiempo." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* opcional */
  }

  const references = (Array.isArray(body.references) ? body.references : []).map((r) => String(r).trim()).filter(Boolean);
  if (references.length === 0) return NextResponse.json({ ok: false, error: "No hay pedidos seleccionados." }, { status: 400 });
  if (references.length > MAX_REFS) return NextResponse.json({ ok: false, error: `Máximo ${MAX_REFS} por lote.` }, { status: 400 });

  const dateMode: "paid" | "today" = body.dateMode === "today" ? "today" : "paid";

  try {
    const { issued, failed } = await issueInvoicesForOrders({ references, dateMode, numbersByReference: body.numbersByReference });
    return NextResponse.json({ ok: true, issuedCount: issued.length, failedCount: failed.length, issued, failed });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo emitir el lote." }, { status: 500 });
  }
}
