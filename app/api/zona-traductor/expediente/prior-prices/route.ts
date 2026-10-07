import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { findPriorPrices } from "@/lib/prior-prices";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const items = (Array.isArray(body?.items) ? body.items : [])
    .slice(0, 40)
    .map((i: any) => ({
      source: String(i?.source || "").trim().toLowerCase().slice(0, 8),
      target: String(i?.target || "").trim().toLowerCase().slice(0, 8),
      label: String(i?.label || "").trim().slice(0, 200),
    }))
    .filter((i: { source: string; target: string; label: string }) => i.source && i.target && i.label);

  const matches = await findPriorPrices(items).catch(() => ({}));
  return NextResponse.json({ ok: true, matches });
}
