// app/api/cron/contador/route.ts — Respaldo del callback del contador de TraduCAT
// (cada 2 min): reenvía los que no salieron, consulta los vivos y se rinde a los
// 10 min (se queda la cifra de Haiku). Con el flag apagado no hace nada.
import { NextResponse } from "next/server";
import { hasCronSecret } from "@/lib/cron-auth";
import { runContadorCron } from "@/lib/contador/flow";
import { contadorDeps } from "@/lib/contador/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  try {
    const r = await runContadorCron(contadorDeps(), { limit: 20 });
    return NextResponse.json({ ok: true, ...r });
  } catch (err: any) {
    console.error("[cron/contador]", err?.message || err);
    return NextResponse.json({ ok: false, error: err?.message || "Error." }, { status: 500 });
  }
}
