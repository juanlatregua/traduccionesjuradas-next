import { NextResponse } from "next/server";
import { buildStaffDigest, buildDigestHtml } from "@/lib/funnel-digest";
import { sendMail } from "@/lib/azure-mail";
import { wrapClientEmailHtml } from "@/lib/email";
import { hasCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";

/* Cron diario 07:00 UTC (≈09:00 Madrid en verano CEST / 08:00 en invierno;
   Vercel ejecuta los crons en UTC): resumen de actividad a staff — pedidos pagados,
   embudo de intentos, idiomas y emails fallidos en 24 h. Sirve de heartbeat:
   si Juan deja de recibirlo, algo de la automatización se ha parado. */

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const to = process.env.PRESUPUESTO_TO;
  if (!to) {
    return NextResponse.json({ ok: false, error: "Missing PRESUPUESTO_TO" }, { status: 500 });
  }

  try {
    const digest = await buildStaffDigest(24);
    const subject = `Resumen diario · ${digest.paidOrders.length} pedido(s) pagado(s) · ${digest.day.analizado} intentos`;
    await sendMail({ to, subject, html: wrapClientEmailHtml(buildDigestHtml(digest)) });
    return NextResponse.json({
      ok: true,
      paidOrders: digest.paidOrders.length,
      attempts24h: digest.day.analizado,
      failedEmails24h: digest.failedEmails.length,
    });
  } catch (err: any) {
    console.error("[cron:staff-digest] failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "digest failed" }, { status: 500 });
  }
}
