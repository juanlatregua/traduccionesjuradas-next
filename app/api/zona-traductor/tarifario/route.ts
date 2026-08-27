// POST /api/zona-traductor/tarifario — aprobar / vetar / pausar / corregir una tarifa aprendida.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { recordSample } from "@/lib/learned-rates";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "").trim();
  const action = String(body?.action || "").trim();
  if (!id || !action) {
    return NextResponse.json({ ok: false, error: "Faltan id o acción." }, { status: 400 });
  }
  const rate = await prisma.learnedRate.findUnique({ where: { id } });
  if (!rate) {
    return NextResponse.json({ ok: false, error: "Tarifa no encontrada." }, { status: 404 });
  }
  try {
    if (action === "approve" || action === "veto" || action === "candidate") {
      const status = action === "approve" ? "APPROVED" : action === "veto" ? "VETOED" : "CANDIDATE";
      await prisma.learnedRate.update({ where: { id }, data: { status, note: rate.note } });
      return NextResponse.json({ ok: true, status });
    }
    if (action === "update") {
      const num = (v: unknown) => {
        const n = Number(String(v ?? "").replace(",", "."));
        return Number.isFinite(n) && n > 0 ? n : null;
      };
      const costEur = num(body.costEur);
      const clientEur = num(body.clientEur);
      const plazoDias = num(body.plazoDias);
      if (costEur == null && clientEur == null && plazoDias == null) {
        return NextResponse.json({ ok: false, error: "Nada que cambiar." }, { status: 400 });
      }
      await recordSample(
        { lang: rate.lang, direction: rate.direction as "to_es" | "from_es", docType: rate.docType, apostille: rate.apostille },
        {
          unit: rate.unit as "doc" | "kword",
          kind: "manual",
          perUnit: true,
          costCents: costEur != null ? Math.round(costEur * 100) : null,
          clientCents: clientEur != null ? Math.round(clientEur * 100) : null,
          plazoDias: plazoDias != null ? Math.round(plazoDias) : null,
          note: `corregido por ${access.email}`,
        }
      );
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
  } catch (err: any) {
    console.error("[tarifario] error", err);
    return NextResponse.json({ ok: false, error: err?.message || "Error" }, { status: 500 });
  }
}
