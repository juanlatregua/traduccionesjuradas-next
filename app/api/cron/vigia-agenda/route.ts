import { NextResponse } from "next/server";
import { buildVigia, renderAgendaHtml } from "@/lib/vigia";
import { sendMail } from "@/lib/azure-mail";
import { wrapClientEmailHtml } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

/* Cron diario 06:00 UTC (08:00 Madrid en verano): AGENDA DE HOY a Juan — qué
   traducir (lo suyo, por vencimiento, con horas estimadas), qué entregas de
   colaboradores seguir y las acciones de gestión del vigía. Pedido de Juan
   26-ago-2026 ("estoy un poco rebasado"): el digest de las 9:00 cuenta el embudo;
   este cuenta el día. Misma fuente que el agente vigia-pedidos (lib/vigia.ts). */

function hasCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === secret || header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!hasCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  const to = process.env.PRESUPUESTO_TO;
  if (!to) {
    return NextResponse.json({ ok: false, error: "Missing PRESUPUESTO_TO" }, { status: 500 });
  }
  try {
    const v = await buildVigia(7);
    const a = v.agenda;
    const urgent = a.traducir.filter((i) => i.venceDias != null && i.venceDias <= 0).length;
    const subject = `Agenda de hoy · ${a.traducir.length} por traducir (${a.palabrasSemana} pal ≈ ${a.horasSemana} h)${urgent ? ` · ${urgent} vence(n) hoy o antes` : ""} · ${v.acciones.length} acciones`;
    await sendMail({ to, subject, html: wrapClientEmailHtml(renderAgendaHtml(v)) });
    return NextResponse.json({ ok: true, traducir: a.traducir.length, seguir: a.seguir.length, sinFecha: a.sinFecha.length, acciones: v.acciones.length });
  } catch (err: any) {
    console.error("[cron:vigia-agenda] failed", err);
    return NextResponse.json({ ok: false, error: err?.message || "agenda failed" }, { status: 500 });
  }
}
