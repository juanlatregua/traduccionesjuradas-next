import { NextResponse } from "next/server";
import { runAutoenvio150 } from "@/lib/autoenvio-150";
import { hasCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Cron cada 10 min de 06 a 21 UTC, solo de 08:00 a 22:00 Madrid: borrador no FR de la puerta/bandeja/encargo
   cerrado sin tocar a los 150 min de la llegada → sale solo si pasa todas las guardas. AUTOENVIO_150=on. */

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runAutoenvio150()) });
  } catch (err: any) {
    console.error("[cron:autoenvio-150] failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "autoenvio-150 failed" }, { status: 500 });
  }
}
