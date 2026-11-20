// app/api/zona-traductor/contador/[id]/route.ts — Estado del contador de TraduCAT
// para un documento (staff): «Contando palabras… N de M páginas».
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { statusForDocument } from "@/lib/contador/flow";
import { contadorDeps } from "@/lib/contador/server";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  try {
    const status = await statusForDocument(contadorDeps(), String(params.id || "").slice(0, 100));
    return NextResponse.json({ ok: true, ...status }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    console.error("[zona-traductor/contador]", err?.message || err);
    return NextResponse.json({ ok: false, error: "Error interno." }, { status: 500 });
  }
}
