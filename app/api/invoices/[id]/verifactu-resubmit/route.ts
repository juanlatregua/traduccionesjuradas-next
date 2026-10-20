// app/api/invoices/[id]/verifactu-resubmit/route.ts
// STAFF: «reenviar como subsanación» el registro VeriFactu de una factura cuyo alta fue
// rechazado por la AEAT (o aceptado con errores), tras corregir los datos del destinatario.

import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { flushAfterCommit, resubmitAsSubsanacion } from "@/lib/verifactu/records";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  const rl = await checkRateLimit({ key: `verifactu-resubmit:${access.email}`, limit: 5, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Demasiados reenvíos seguidos. Espera unos minutos." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  try {
    const r = await resubmitAsSubsanacion(params.id, access.email);
    await flushAfterCommit();
    return NextResponse.json({ ok: true, ...r });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo reenviar." }, { status: 400 });
  }
}
