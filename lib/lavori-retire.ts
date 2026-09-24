// lib/lavori-retire.ts — Sacar una solicitud de precio de lavori (retirada real del
// encargo) y cerrarla en tj.net. Es la salida del freno anti-duplicado: solo con la
// retirada confirmada deja de contar como viva (Juan, 24-sep-2026).

import { prisma } from "@/lib/prisma";
import { retireLavoriEncargo } from "@/lib/lavori-bridge";

const RETIRABLE = ["SENT", "PRICED", "ACCEPTED", "ESCALATED"];

export type RetireLeadResult =
  | { ok: true; ref: string; retiradoEnLavori: boolean }
  | { ok: false; status: number; error: string };

export async function retireLeadRequest(opts: {
  id: string;
  actorEmail: string;
  motivo: string;
  terminal: "RETIRED" | "DISCARDED";
  lavoriMotivo?: "reasignado" | "duplicado" | "cliente" | "otro";
  allowedStatuses?: string[];
  requireNoQuote?: boolean;
}): Promise<RetireLeadResult> {
  const lpr = await prisma.lavoriPriceRequest.findUnique({
    where: { id: opts.id },
    select: { ref: true, status: true, encargoId: true, notas: true, quoteId: true, expedienteRef: true },
  });
  if (!lpr) return { ok: false, status: 404, error: "Solicitud no encontrada." };
  const allowed = opts.allowedStatuses ?? RETIRABLE;
  if (!allowed.includes(lpr.status)) return { ok: false, status: 409, error: `Está en estado ${lpr.status}: no se puede retirar.` };
  if (opts.requireNoQuote && lpr.quoteId) return { ok: false, status: 409, error: "Ya tiene presupuesto atado: retírala con «Retirar en lavori»." };

  // Reserva ANTES de llamar a lavori: mientras dura la llamada nadie la toca (un
  // precio que llegue ahora solo avisa) y el freno la sigue contando como viva.
  const reserva = await prisma.lavoriPriceRequest.updateMany({
    where: { id: opts.id, status: lpr.status, quoteId: lpr.quoteId },
    data: { status: "RETIRING" },
  });
  if (reserva.count === 0) return { ok: false, status: 409, error: "Cambió de estado ahora mismo (llegó un precio o se ató a un presupuesto): revísala antes." };

  let retiradoEnLavori = false;
  if (lpr.encargoId) {
    const r = await retireLavoriEncargo(`${lpr.ref}-precio`, opts.lavoriMotivo ?? "otro");
    if (!r.ok) {
      await prisma.lavoriPriceRequest.updateMany({ where: { id: opts.id, status: "RETIRING" }, data: { status: lpr.status } });
      return {
        ok: false,
        status: r.adjudicado ? 409 : 502,
        error: r.adjudicado
          ? `No se retira: ${r.error}${r.adjudicado.desde ? ` desde ${r.adjudicado.desde.slice(0, 16).replace("T", " ")}` : ""}. Decide con ese jurado antes.`
          : `No se pudo retirar en lavori (${r.error}). No se ha tocado nada; inténtalo de nuevo.`,
      };
    }
    retiradoEnLavori = r.retirado;
  }

  const sello = `${opts.terminal === "DISCARDED" ? "Descartada" : "Retirada en lavori"} por ${opts.actorEmail} el ${new Date().toISOString()}: ${opts.motivo}`;
  await prisma.lavoriPriceRequest.updateMany({
    where: { id: opts.id, status: "RETIRING" },
    data: { status: opts.terminal, notas: [lpr.notas, sello].filter(Boolean).join("\n") },
  });

  // Pedidos pagados cuya aceptación se frenó por ESTE duplicado: ahora que ya no
  // vive, se reintenta la asignación con la cifra buena (sin esperar a nadie).
  await relanzarAceptacionesFrenadas(lpr.expedienteRef, opts.actorEmail).catch((err) =>
    console.error("[lavori-retire] relanzar aceptación fallo:", err)
  );
  return { ok: true, ref: lpr.ref, retiradoEnLavori };
}

async function relanzarAceptacionesFrenadas(expedienteRef: string | null, actorEmail: string) {
  if (!expedienteRef) return;
  const hermanas = await prisma.lavoriPriceRequest.findMany({
    where: { expedienteRef, quoteId: { not: null } },
    select: { quoteId: true },
  });
  const quoteIds = Array.from(new Set(hermanas.map((h) => h.quoteId).filter(Boolean))) as string[];
  if (quoteIds.length === 0) return;
  const pedidos = await prisma.order.findMany({
    where: {
      quoteId: { in: quoteIds },
      paymentStatus: "PAID",
      events: { some: { type: "lavori.aceptacion_frenada" } },
      NOT: { events: { some: { type: { in: ["lavori.precio_aceptado_enviado", "lavori.encargo_aceptado"] } } } },
    },
    select: { reference: true },
  });
  if (pedidos.length === 0) return;
  const { autoAssignCollaboratorIfNeeded } = await import("@/lib/workflow-server");
  for (const p of pedidos) await autoAssignCollaboratorIfNeeded({ reference: p.reference, actorEmail });
}
