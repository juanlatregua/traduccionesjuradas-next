// lib/lavori-assign.ts — Un jurado de lavori ha aceptado el encargo de un pedido:
// asignación como colaborador, coste, devengo y aviso al cliente. Chokepoint único
// para el receptor de eventos (encargo_aceptado) y para el pago cuando la solicitud
// ya estaba ACCEPTED antes de marcar el pago (antes abría un encargo duplicado).

import { prisma } from "@/lib/prisma";
import { applyAcceptedQuoteSideEffects } from "@/lib/collaborators";
import { LAVORI_MEMBER_COLLABORATOR_EMAIL } from "@/lib/lavori-bridge";

export async function assignLavoriAcceptance(opts: {
  order: { id: string; reference: string };
  miembroId: string;
  miembroNombre?: string | null;
  /** Cifra que la casa debe al jurado (céntimos); sin ella la asignación queda sin coste. */
  paraTiCents: number | null;
  encargoId: string;
  motorRef: string;
  /** Datos extra del evento (los del sobre de lavori, o el origen si viene del pago). */
  payload?: Record<string, unknown>;
}) {
  const { order, miembroId, encargoId, motorRef, paraTiCents } = opts;
  const email = LAVORI_MEMBER_COLLABORATOR_EMAIL[miembroId];
  const collaborator = email ? await prisma.collaborator.findUnique({ where: { email } }) : null;
  const miembro = String(opts.miembroNombre || miembroId || "el traductor");

  if (collaborator) {
    const yaContabilizado = Boolean(
      await prisma.orderEvent.findFirst({ where: { orderId: order.id, type: "collaborator.quote.accepted" }, select: { id: true } })
    );
    const assignment = await prisma.collaboratorAssignment.upsert({
      where: { orderId_collaboratorId: { orderId: order.id, collaboratorId: collaborator.id } },
      create: {
        orderId: order.id,
        collaboratorId: collaborator.id,
        status: "ACCEPTED",
        acceptedAt: new Date(),
        isWinning: true,
        ...(paraTiCents ? { quotedPriceCents: paraTiCents, quotedAt: new Date() } : {}),
      },
      update: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
        isWinning: true,
        ...(paraTiCents ? { quotedPriceCents: paraTiCents } : {}),
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { assignedTo: collaborator.fullName } });
    if (paraTiCents && !yaContabilizado) {
      const full = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { id: true, amountCents: true, paymentStatus: true, marginPct: true },
      });
      const sideFx = await applyAcceptedQuoteSideEffects(prisma, {
        order: full,
        assignmentId: assignment.id,
        supplierCostCents: paraTiCents,
        collaborator: { fullName: collaborator.fullName, companyName: collaborator.companyName, supplierType: collaborator.supplierType },
        actorEmail: "lavori-bridge",
        isWinning: true,
      }).catch((err) => {
        console.error("[lavori-assign] side effects failed", err);
        return { marginAlert: null as null | (() => Promise<void>) };
      });
      if (sideFx.marginAlert) await sideFx.marginAlert();
    }
    // Import dinámico: lib/orders importa workflow-server y éste a este módulo.
    import("@/lib/orders")
      .then((m) =>
        m.notifyClientTranslationStarted({
          reference: order.reference,
          translatorName: collaborator.fullName,
          swornNumber: collaborator.swornNumber,
          actorEmail: "lavori-bridge",
        })
      )
      .catch((err) => console.error("[lavori-assign] client notify failed", err));
  }

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "lavori.encargo_aceptado",
      message: collaborator
        ? `lavori: ${miembro} aceptó el encargo — asignado automáticamente como colaborador.`
        : `lavori: ${miembro} aceptó el encargo, pero no está mapeado como colaborador — asignar a mano.`,
      payload: { encargoId, motorRef, ...(opts.payload || {}), autoAssigned: Boolean(collaborator) },
    },
  });

  return { collaborator, miembro };
}
