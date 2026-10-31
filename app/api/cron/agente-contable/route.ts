import { NextResponse } from "next/server";
import { runAgenteContable, renderResumenContable, sellarAvisados } from "@/lib/agente-contable";
import { isEmailConfigured, sendMail } from "@/lib/azure-mail";
import { wrapClientEmailHtml } from "@/lib/email";
import { hasCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

/* Cron diario: el agente contabiliza solo las facturas de traductor que cuadran y
   manda a Juan UN email con lo hecho y lo parado. Kill-switch: AGENTE_CONTABLE. */

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  try {
    const r = await runAgenteContable();
    if ("skipped" in r) return NextResponse.json({ ok: true, skipped: r.skipped });

    const hechas = r.resultados.filter((x) => x.estado === "contabilizada").length;
    const paradas = r.resultados.filter((x) => x.estado === "parada" && x.nueva).length;
    const to = process.env.PRESUPUESTO_TO;
    if (hechas + paradas > 0 && (!to || !isEmailConfigured())) throw new Error("Sin correo configurado: el resumen no se puede enviar.");
    if (hechas + paradas > 0 && to) {
      await sendMail({
        to,
        subject: `Agente contable · ${hechas} contabilizadas · ${paradas} paradas para ti`,
        html: wrapClientEmailHtml(renderResumenContable(r.resultados)),
      });
      await sellarAvisados(r.resultados);
    }
    return NextResponse.json({ ok: true, hechas, paradas, revisadas: r.resultados.length });
  } catch (err: any) {
    console.error("[cron:agente-contable] failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "agente-contable failed" }, { status: 500 });
  }
}
