import { NextResponse } from "next/server";
import { runClientesAMedias } from "@/lib/clientes-a-medias";
import { hasCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Cron 0 6-20 * * * (UTC): informe «clientes a medias» de 08:00 a 21:00 Madrid, solo si hay algo nuevo.
   Interruptor CLIENTES_A_MEDIAS_INFORME=on. Orden de Juan 21-nov-2026. */

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runClientesAMedias()) });
  } catch (err: any) {
    console.error("[cron:clientes-a-medias] failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "clientes-a-medias failed" }, { status: 500 });
  }
}
