import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { applyAcceptedQuoteSideEffects } from "@/lib/collaborators";
import { notifyClientTranslationStarted } from "@/lib/orders";
import {
  sendAcceptanceToCollaborator,
  sendRejectionToCollaborator,
} from "@/lib/collaborator-emails";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type SelectBidBody = { assignmentId: string };

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json()) as SelectBidBody;
    if (!body.assignmentId?.trim()) {
      return NextResponse.json({ ok: false, error: "assignmentId es obligatorio." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: { id: true, amountCents: true, paymentStatus: true, marginPct: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const chosen = await prisma.collaboratorAssignment.findUnique({
      where: { id: body.assignmentId.trim() },
      include: {
        collaborator: {
          select: {
            fullName: true,
            email: true,
            companyName: true,
            supplierType: true,
            swornNumber: true,
          },
        },
      },
    });

    if (!chosen || chosen.orderId !== order.id) {
      return NextResponse.json({ ok: false, error: "Presupuesto no encontrado para este pedido." }, { status: 404 });
    }
    if (chosen.status !== "QUOTED") {
      return NextResponse.json(
        { ok: false, error: "Solo se puede elegir un presupuesto en estado QUOTED." },
        { status: 400 }
      );
    }
    if (!chosen.quotedPriceCents || chosen.quotedPriceCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "El presupuesto elegido no tiene precio válido." },
        { status: 400 }
      );
    }

    // Los demás presupuestos QUOTED del pedido se rechazan.
    const losers = await prisma.collaboratorAssignment.findMany({
      where: { orderId: order.id, status: "QUOTED", id: { not: chosen.id } },
      include: { collaborator: { select: { fullName: true, email: true } } },
    });

    const priceCents = chosen.quotedPriceCents;

    // Transacción: aceptar la elegida + rechazar el resto + side-effects de finanzas.
    await prisma.$transaction(async (tx) => {
      await tx.collaboratorAssignment.update({
        where: { id: chosen.id },
        data: { status: "ACCEPTED", acceptedAt: new Date(), isWinning: true },
      });

      // Poblar Order.assignedTo con el ganador (mantiene Kanban/Cockpit vivos
      // y permite resolver el nº de jurado para el aviso al cliente).
      await tx.order.update({
        where: { id: order.id },
        data: { assignedTo: chosen.collaborator.fullName },
      });

      for (const loser of losers) {
        await tx.collaboratorAssignment.update({
          where: { id: loser.id },
          data: {
            status: "REJECTED",
            rejectedAt: new Date(),
            rejectionReason: "Se eligió otra oferta más competitiva.",
          },
        });
      }

      await applyAcceptedQuoteSideEffects(tx, {
        order: {
          id: order.id,
          amountCents: order.amountCents,
          paymentStatus: order.paymentStatus,
          marginPct: order.marginPct,
        },
        assignmentId: chosen.id,
        supplierCostCents: priceCents,
        quotedDeadline: chosen.quotedDeadline,
        collaborator: chosen.collaborator,
        actorEmail: staff.email,
        isWinning: true,
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: "collaborator.bid_selected",
          message: `Oferta ganadora: ${chosen.collaborator.fullName} (${(priceCents / 100).toFixed(2)}€). Rechazadas ${losers.length}.`,
          payload: {
            winningAssignmentId: chosen.id,
            winningCollaborator: chosen.collaborator.fullName,
            priceCents,
            rejectedAssignmentIds: losers.map((l) => l.id),
            actorEmail: staff.email,
          },
        },
      });
    });

    // Aviso al CLIENTE (en proceso + nº jurado) + transición EN_TRADUCCION
    // (dispara el SMS de hito). Fire-and-forget, idempotente por estado.
    notifyClientTranslationStarted({
      reference: params.reference,
      translatorName: chosen.collaborator.fullName,
      swornNumber: chosen.collaborator.swornNumber,
      dueDate: chosen.quotedDeadline,
      actorEmail: staff.email,
    }).catch((err) => console.error("[select-bid] client notify failed", err));

    // Emails fire-and-forget (no bloquean la respuesta).
    sendAcceptanceToCollaborator({
      collaboratorName: chosen.collaborator.fullName,
      collaboratorEmail: chosen.collaborator.email,
      orderReference: params.reference,
      priceCents,
      accessToken: chosen.accessToken,
      dueDate: chosen.quotedDeadline,
    }).catch((err) => console.error("[select-bid] acceptance email failed", err));

    for (const loser of losers) {
      sendRejectionToCollaborator({
        collaboratorName: loser.collaborator.fullName,
        collaboratorEmail: loser.collaborator.email,
        orderReference: params.reference,
        reason: "Se eligió otra oferta más competitiva.",
      }).catch((err) => console.error("[select-bid] rejection email failed", err));
    }

    return NextResponse.json({
      ok: true,
      winningAssignmentId: chosen.id,
      rejectedCount: losers.length,
    });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Recurso no encontrado o estado no válido." }, { status: 404 });
    }
    console.error("[select-bid] error", err);
    return NextResponse.json({ ok: false, error: "Error al seleccionar la oferta." }, { status: 500 });
  }
}
