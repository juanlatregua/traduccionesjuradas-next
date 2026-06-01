// app/api/bank/decision/route.ts — STAFF ADMIN/PM: persiste SOLO la decisión sobre
// una línea bancaria (ignorar / emparejar a mano) por hash. Sin datos del extracto.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";

export const runtime = "nodejs";

type Body = {
  lineHash?: string;
  status?: "IGNORED" | "MATCHED_MANUAL";
  matchedType?: string | null;
  matchedId?: string | null;
  note?: string | null;
  brand?: string | null;
};

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
  await prisma.bankDecision.deleteMany({ where: { lineHash } });
  return NextResponse.json({ ok: true });
}
