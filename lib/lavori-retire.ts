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
  lavoriMotivo?: "reasignado" | "duplicado" | "cliente" | "otro" | "asignado_fuera";
  forzar?: boolean;
  allowedStatuses?: string[];
  requireNoQuote?: boolean;
  /** false = no reintentar asignaciones frenadas (quien llama ya ha asignado el pedido). */
  relanzar?: boolean;
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
    const r = await retireLavoriEncargo(`${lpr.ref}-precio`, opts.lavoriMotivo ?? "otro", opts.forzar === true);
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
  if (opts.relanzar !== false) {
    await relanzarAceptacionesFrenadas(lpr.expedienteRef, opts.actorEmail).catch((err) =>
      console.error("[lavori-retire] relanzar aceptación fallo:", err)
    );
  }
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

// Pedido asignado FUERA de lavori («Precio ya pactado», contrato 3-oct-2026 paso 4):
// se retira lo que siga vivo en lavori para ese pedido —solicitudes atadas a su
// presupuesto y el encargo abierto desde el propio pedido—, salvo el del mismo jurado
// al que se acaba de asignar. Aceptado sin entrega ni pago: se fuerza (lavori avisa
// al aceptante «el cliente lo ha resuelto por otra vía»).
export async function retireLavoriForOutsideAssignment(opts: {
  order: { id: string; reference: string; quoteId: string | null };
  collaboratorEmail: string;
  actorEmail: string;
}): Promise<{ retiradas: string[]; fallidas: Array<{ ref: string; error: string }> }> {
  const { LAVORI_MEMBER_COLLABORATOR_EMAIL } = await import("@/lib/lavori-bridge");
  const mismoJurado = (miembroId: string | null) =>
    Boolean(miembroId && LAVORI_MEMBER_COLLABORATOR_EMAIL[miembroId]?.toLowerCase() === opts.collaboratorEmail.toLowerCase());
  const retiradas: string[] = [];
  const fallidas: Array<{ ref: string; error: string }> = [];

  const vivas = opts.order.quoteId
    ? await prisma.lavoriPriceRequest.findMany({
        where: { quoteId: opts.order.quoteId, status: { in: ["SENT", "PRICED", "ACCEPTED", "ESCALATED"] }, encargoId: { not: null } },
        select: { id: true, ref: true, miembroId: true, candidatos: true },
      })
    : [];
  for (const lpr of vivas) {
    // Sin cifra aún no hay miembroId: si se pidió solo a ese jurado, es la suya.
    if (mismoJurado(lpr.miembroId ?? (lpr.candidatos.length === 1 ? lpr.candidatos[0] : null))) continue;
    const r = await retireLeadRequest({
      id: lpr.id,
      actorEmail: opts.actorEmail,
      motivo: `pedido ${opts.order.reference} asignado fuera de lavori con precio pactado`,
      terminal: "RETIRED",
      lavoriMotivo: "asignado_fuera",
      forzar: true,
      relanzar: false,
    });
    if (r.ok) retiradas.push(lpr.ref);
    else fallidas.push({ ref: lpr.ref, error: r.error });
  }

  // Encargos abiertos desde el propio pedido: el dirigido (motorRef = referencia) y la
  // solicitud de precio de la ficha (motorRef = referencia + "-precio").
  const eventos = await prisma.orderEvent.findMany({
    where: {
      orderId: opts.order.id,
      type: { in: ["lavori.solicitud_enviada", "lavori.solicitud_precio_enviada", "lavori.encargo_aceptado", "lavori.retirado_por_motor"] },
    },
    orderBy: { createdAt: "desc" },
    select: { type: true, payload: true },
  });
  const yaRetirados = new Set(
    eventos.filter((e) => e.type === "lavori.retirado_por_motor").map((e) => String((e.payload as { motorRef?: unknown } | null)?.motorRef || ""))
  );
  const { retireLavoriEncargo } = await import("@/lib/lavori-bridge");
  for (const [tipo, motorRef] of [
    ["lavori.solicitud_enviada", opts.order.reference],
    ["lavori.solicitud_precio_enviada", `${opts.order.reference}-precio`],
  ] as const) {
    const ev = eventos.find((e) => e.type === tipo);
    if (!ev || yaRetirados.has(motorRef)) continue;
    const candidatos = (ev.payload as { candidatos?: unknown } | null)?.candidatos;
    const unico = Array.isArray(candidatos) && candidatos.length === 1 ? String(candidatos[0]) : null;
    const aceptante = (
      eventos.find((e) => e.type === "lavori.encargo_aceptado" && (e.payload as { motorRef?: unknown } | null)?.motorRef === motorRef)
        ?.payload as { miembroId?: unknown } | null
    )?.miembroId;
    if (mismoJurado(aceptante ? String(aceptante) : unico)) continue;
    const r = await retireLavoriEncargo(motorRef, "asignado_fuera", true);
    if (r.ok) {
      retiradas.push(motorRef);
      await prisma.orderEvent.create({
        data: {
          orderId: opts.order.id,
          type: "lavori.retirado_por_motor",
          message: `Encargo ${motorRef} retirado en lavori (asignado fuera con precio pactado)${r.retirado ? "" : "; ya no estaba vivo"}.`,
          payload: { motorRef, retirado: r.retirado, estado: r.estado, actorEmail: opts.actorEmail },
        },
      });
    } else {
      fallidas.push({ ref: motorRef, error: r.error });
    }
  }
  return { retiradas, fallidas };
}
