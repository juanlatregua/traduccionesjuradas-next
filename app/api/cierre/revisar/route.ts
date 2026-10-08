import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyCierreToken } from "@/lib/cierre-token";

export const runtime = "nodejs";

/* «Revisar y enviar» del aviso a staff (lib/cierre.ts): enlace firmado de un toque
   que abre el presupuesto en borrador, ya montado, en la zona del traductor. NO envía
   nada ni escribe en BD: el envío sigue siendo el botón de la ficha (con su freno). */
export async function GET(req: Request) {
  const rl = await checkRateLimit({ key: `cierre-revisar:${getClientIp(req)}`, limit: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return new NextResponse("Demasiados intentos.", { status: 429 });
  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") || "").slice(0, 80);
  const t = String(url.searchParams.get("t") || "").slice(0, 120);
  const base = (process.env.NEXTAUTH_URL || url.origin).replace(/\/$/, "");
  if (!verifyCierreToken(q, t)) return NextResponse.redirect(`${base}/zona-traductor/vigia`, 302);
  return NextResponse.redirect(`${base}/zona-traductor/presupuestos/${encodeURIComponent(q)}`, 302);
}
