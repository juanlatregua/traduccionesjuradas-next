// lib/lavori-assign.ts — Un jurado de lavori ha aceptado el encargo de un pedido:
// asignación como colaborador, coste, devengo y aviso al cliente. Chokepoint único
// para el receptor de eventos (encargo_aceptado) y para el pago cuando la solicitud
// ya estaba ACCEPTED antes de marcar el pago (antes abría un encargo duplicado).

import { prisma } from "@/lib/prisma";
import { applyAcceptedQuoteSideEffects } from "@/lib/collaborators";
import { LAVORI_MEMBER_COLLABORATOR_EMAIL, sameTranslatorName } from "@/lib/lavori-bridge";
import { priceBasisForMember } from "@/lib/lavori-directo";
import { channelPriceToBaseCents } from "@/lib/lavori-directo-math";
import { netFromGross } from "@/lib/quotes";

/** El presupuesto lleva el jurado que se anunció al cliente (la primera cifra de la
 * cartera o de la solicitud). Si quien ACEPTA en lavori es otro (26_546077, 26_95DA0E,
 * 26_B39FE1, 26_FD0B71: Leticia, Iria y Cristina en el presupuesto; aceptaron María
 * Lourdes y Carmen), la página del presupuesto, la ficha y los avisos al cliente
 * deben decir quién lo traduce de verdad. Deja registro en un evento del pedido. */
export async function syncQuoteTranslatorWithAcceptor(opts: {
  quoteId: string | null | undefined;
  orderId?: string | null;
  nombre: string | null | undefined;
  maec?: string | null;
  miembroId?: string | null;
  /** Carril de leads: solo si el presupuesto no está cobrado; un nombre fijado al
   * enviarlo a mano (adminSentBy) se respeta. */
  soloSinEnviar?: boolean;
}): Promise<{ changed: boolean }> {
  const nombre = String(opts.nombre || "").trim();
  if (!opts.quoteId || !nombre) return { changed: false };
  const quote = await prisma.quote.findUnique({
    where: { id: opts.quoteId },
    select: { id: true, quoteNumber: true, translatorName: true, translatorMaec: true, status: true, adminSentBy: true },
  });
  if (quote && opts.soloSinEnviar && (["PAID", "IN_PROGRESS", "DELIVERED"].includes(quote.status) || quote.adminSentBy)) return { changed: false };
  if (!quote || sameTranslatorName(quote.translatorName, nombre)) return { changed: false };
  await prisma.quote.update({
    where: { id: quote.id },
    data: { translatorName: nombre, translatorMaec: opts.maec || null },
  });
  if (opts.orderId) {
    await prisma.orderEvent.create({
      data: {
        orderId: opts.orderId,
        type: "quote.translator_updated",
        message: `Presupuesto ${quote.quoteNumber}: el jurado pasa de «${quote.translatorName || "(sin nombre)"}» a «${nombre}», que es quien aceptó el encargo en lavori.`,
        payload: {
          quoteId: quote.id,
          antes: { translatorName: quote.translatorName, translatorMaec: quote.translatorMaec },
          despues: { translatorName: nombre, translatorMaec: opts.maec || null },
          miembroId: opts.miembroId ?? null,
        },
      },
    });
  }
  return { changed: true };
}

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
  // Contabilidad en BASE (Juan, 15-sep-2026): la cifra que da el jurado puede
  // ser el líquido a cobrar (base + IVA − IRPF); al jurado se le sigue
  // comunicando SU cifra (deliverPrecioAceptado no se toca), pero el coste que
  // guardamos aquí es la base, o Daniela contabiliza 100 € en vez de 94,34 €.
  const baseCents = paraTiCents != null ? channelPriceToBaseCents(paraTiCents, priceBasisForMember(miembroId)) : null;

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
        ...(baseCents ? { quotedPriceCents: baseCents, quotedAt: new Date() } : {}),
      },
      update: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        rejectedAt: null,
        rejectionReason: null,
        isWinning: true,
        ...(baseCents ? { quotedPriceCents: baseCents } : {}),
      },
    });
    await prisma.order.update({ where: { id: order.id }, data: { assignedTo: collaborator.fullName } });
    if (baseCents && !yaContabilizado) {
      const full = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { id: true, amountCents: true, paymentStatus: true, marginPct: true },
      });
      const sideFx = await applyAcceptedQuoteSideEffects(prisma, {
        order: full,
        assignmentId: assignment.id,
        supplierCostCents: baseCents,
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

  // Sin colaborador mapeado la asignación sigue a mano, pero el coste y el plazo
  // no se pierden (Juan, 25-sep-2026: el margen tiene que constar siempre).
  const fechaEntrega = opts.payload?.fechaEntrega ? Date.parse(String(opts.payload.fechaEntrega)) : NaN;
  if (!collaborator && baseCents) {
    // Mismo snapshot y misma alarma que con colaborador: sin ficha el margen
    // cero o negativo también se avisa por email + SMS, no se descubre al asignar.
    // Coste y snapshot en la misma transacción: si el snapshot falla, el reintento
    // de lavori vuelve a encontrar el coste vacío y el aviso no se pierde.
    const margen = await prisma.$transaction(async (tx) => {
      const costeGuardado = await tx.order.updateMany({ where: { id: order.id, supplierCostCents: null }, data: { supplierCostCents: baseCents } });
      if (costeGuardado.count === 0) return null;
      const cobro = await tx.order.findUnique({ where: { id: order.id }, select: { amountCents: true } });
      const revenueNetCents = netFromGross(cobro?.amountCents || 0);
      const marginCents = revenueNetCents - baseCents;
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "finance.margin.snapshot",
          message: `Snapshot de margen (sin colaborador mapeado): ingreso neto ${(revenueNetCents / 100).toFixed(2)}€ − coste ${(baseCents / 100).toFixed(2)}€ = ${(marginCents / 100).toFixed(2)}€.`,
          payload: {
            supplierCostCents: baseCents,
            revenueCents: revenueNetCents,
            grossRevenueCents: cobro?.amountCents || 0,
            marginCents,
            marginBasis: "net_of_vat",
            miembroId,
          },
        },
      });
      return { revenueNetCents, marginCents };
    });
    if (margen && margen.marginCents <= 0) {
      const { alertStaffMargin } = await import("@/lib/ai/outage-alert");
      await alertStaffMargin({ orderId: order.id, supplier: miembro, supplierCostCents: baseCents, ...margen });
    }
  }
  if (Number.isFinite(fechaEntrega)) {
    await prisma.order.updateMany({ where: { id: order.id, dueDate: null }, data: { dueDate: new Date(fechaEntrega) } });
  }

  // El presupuesto y los avisos al cliente nombran a quien aceptó, no al de la primera cifra.
  const nombreAceptante = collaborator?.fullName || String(opts.miembroNombre || "").trim();
  if (nombreAceptante) {
    const pedido = await prisma.order.findUnique({ where: { id: order.id }, select: { quoteId: true } }).catch(() => null);
    await syncQuoteTranslatorWithAcceptor({
      quoteId: pedido?.quoteId,
      orderId: order.id,
      nombre: nombreAceptante,
      maec: collaborator?.swornNumber ?? null,
      miembroId,
    }).catch((err) => console.error("[lavori-assign] sync translator failed", err));
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
