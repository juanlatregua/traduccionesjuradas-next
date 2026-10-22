// app/api/cron/verifactu-flush/route.ts — remite a la AEAT (vía proveedor) los
// registros de facturación en cola. Sin proveedor configurado no hace nada.
// Fail-closed por CRON_SECRET como el resto de crons.
import { NextResponse } from "next/server";
import { flushPendingRecords } from "@/lib/verifactu/records";
import { hasCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  try {
    const r = await flushPendingRecords();
    return NextResponse.json({ ok: true, ...r });
  } catch (err: any) {
    console.error("[verifactu-flush]", err?.message || err);
    return NextResponse.json({ ok: false, error: err?.message || "Error." }, { status: 500 });
  }
}
