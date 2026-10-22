import { NextResponse } from "next/server";
import { runLeadSla } from "@/lib/lead-sla";
import { hasCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Cron cada 10 min: lead sin presupuesto enviado a 1 h y a 2,5 h de su llegada → un
   aviso agrupado por email y por SMS (franja 08-22 Madrid). Regla de Juan 22-oct-2026. */

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runLeadSla()) });
  } catch (err: any) {
    console.error("[cron:lead-sla] failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "lead-sla failed" }, { status: 500 });
  }
}
