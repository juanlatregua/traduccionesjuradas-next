// app/api/reconcile/orders/route.ts — STAFF: lista pedidos cobrados sin factura emitida.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { listPaidUnbilledOrders } from "@/lib/reconcile-invoices";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const base = new URL(req.url).searchParams.get("base") === "created" ? "created" : "paid";
  const rows = await listPaidUnbilledOrders({ base });
  const totalAmountCents = rows.reduce((s, r) => s + r.amountCents, 0);
  return NextResponse.json({ ok: true, rows, count: rows.length, totalAmountCents });
}
