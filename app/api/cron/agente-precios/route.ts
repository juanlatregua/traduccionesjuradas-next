import { NextResponse } from "next/server";
import { runAgentePrecios, renderResumenHtml } from "@/lib/agente-precios";
import { sendMail } from "@/lib/azure-mail";
import { wrapClientEmailHtml } from "@/lib/email";
import { hasCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Cron diario: política autónoma del agente de precios (Juan, 9-oct-2026).
   Auto-aprueba las tarifas con patrón repetido, degrada las que se mueven y manda
   a Juan UN email resumen. Kill-switch: LEARNED_RATES_AUTO=off. */

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  try {
    const r = await runAgentePrecios();
    if ("skipped" in r) return NextResponse.json({ ok: true, skipped: r.skipped });

    const nada = r.approved.length + r.degraded.length + r.near.length + r.conversion.length === 0;
    const to = process.env.PRESUPUESTO_TO;
    if (!nada && to) {
      const subject = `Agente de precios · ${r.approved.length} aprobadas · ${r.degraded.length} degradadas · ${r.near.length} a un paso`;
      await sendMail({ to, subject, html: wrapClientEmailHtml(renderResumenHtml(r)) });
    }
    return NextResponse.json({ ok: true, approved: r.approved.length, degraded: r.degraded.length, near: r.near.length, emailed: !nada && !!to });
  } catch (err: any) {
    console.error("[cron:agente-precios] failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "agente-precios failed" }, { status: 500 });
  }
}
