// TEMPORAL (24-sep-2026): prueba de punta a punta de ficheros grandes tj.net→lavori
// desde PROD (el secreto del puente solo vive allí). Solo staff, solo refs «prueba-»
// y SIEMPRE a la candidata de pruebas de lavori. Borrar tras la prueba.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { sendLavoriSolicitud, type SolicitudPayload } from "@/lib/lavori-bridge";

export const runtime = "nodejs";
const PRUEBA_MARGA = "m21hv2kbd6f300i3fmu4fchs";

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  const url = new URL(req.url).searchParams.get("payload") || "";
  if (!/^https:\/\/rlaa04k5yqt7hzrr\.public\.blob\.vercel-storage\.com\/prueba-lavori\//.test(url)) {
    return NextResponse.json({ ok: false, error: "payload no permitido" }, { status: 400 });
  }
  const payload = (await (await fetch(url)).json()) as SolicitudPayload;
  if (!String(payload.ref || "").startsWith("prueba-")) return NextResponse.json({ ok: false, error: "ref no es de prueba" }, { status: 400 });
  const t0 = Date.now();
  const res = await sendLavoriSolicitud({ ...payload, candidatos: [PRUEBA_MARGA] });
  return NextResponse.json({ ...res, ms: Date.now() - t0, documentos: payload.documentos?.length ?? 0, actor: access.email });
}
