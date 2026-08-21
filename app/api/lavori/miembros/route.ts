import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { LAVORI_CANDIDATES, fetchLavoriCartera } from "@/lib/lavori-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cartera de jurados de una lengua para la UI del staff (ficha del pedido y
// builder): proxy de GET lavori.es/api/motor/miembros con el token del motor
// (el navegador nunca lo ve). Solo nombres/ids/señales; lavori no manda email
// ni teléfono del traductor. `live:false` = lavori no respondió y va la tabla
// estática de respaldo.
export async function GET(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const lang = String(new URL(req.url).searchParams.get("lengua") || "").trim().toLowerCase();
  if (!/^[a-z]{2,3}$/.test(lang)) {
    return NextResponse.json({ ok: false, error: "Lengua ilegible." }, { status: 400 });
  }
  const cartera = await fetchLavoriCartera(lang);
  return NextResponse.json({
    ok: true,
    lang,
    live: cartera.live,
    ...(cartera.error ? { error: cartera.error } : {}),
    defaults: LAVORI_CANDIDATES[lang] || [],
    miembros: cartera.miembros,
  });
}
