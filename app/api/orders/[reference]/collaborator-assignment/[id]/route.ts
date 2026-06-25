import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { acceptCollaboratorQuote, rejectCollaboratorQuote, requestQuoteRevision, getDocumentsFromOrder, applyAcceptedQuoteSideEffects } from "@/lib/collaborators";
import { sendAcceptanceToCollaborator, sendAssignmentToCollaborator, sendRejectionToCollaborator, sendRevisionRequestToCollaborator } from "@/lib/collaborator-emails";

export const runtime = "nodejs";

type Params = { params: { reference: string; id: string } };

type ActionBody = {
  action: "accept" | "reject" | "resend-email" | "request-revision";
  reason?: string;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json()) as ActionBody;
    if (!["accept", "reject", "resend-email", "request-revision"].includes(body.action)) {
      return NextResponse.json({ ok: false, error: "action debe ser 'accept', 'reject', 'resend-email' o 'request-revision'." }, { status: 400 });
    }

    if (body.action === "resend-email") {
      const assignment = await prisma.collaboratorAssignment.findUnique({
        where: { id: params.id },
        include: {
          collaborator: { select: { fullName: true, email: true } },
          order: {
            select: {
              id: true,
              reference: true,
              title: true,
              langPair: true,
              events: {
                where: { type: { in: ["presupuesto.submitted", "order.source_document_uploaded"] } },
                orderBy: { createdAt: "desc" },
                take: 20,
              },
            },
          },
        },
      });
      if (!assignment) {
        return NextResponse.json({ ok: false, error: "Encargo no encontrado." }, { status: 404 });
      }

      const documents = getDocumentsFromOrder(assignment.order);

      await sendAssignmentToCollaborator({
        collaboratorName: assignment.collaborator.fullName,
        collaboratorEmail: assignment.collaborator.email,
        orderReference: assignment.order.reference,
        orderTitle: assignment.order.title,
        langPair: assignment.order.langPair,
        accessToken: assignment.accessToken,
        adminNotes: assignment.adminNotes,
        documents,
      });

      await prisma.orderEvent.create({
        data: {
          orderId: assignment.order.id,
          type: "collaborator.assignment.email_resent",
          message: `Email de encargo reenviado a ${assignment.collaborator.fullName} (${assignment.collaborator.email}).`,
          payload: { assignmentId: assignment.id, actorEmail: staff.email },
        },
      });

      return NextResponse.json({ ok: true, message: "Email reenviado." });
    }

    if (body.action === "request-revision") {
      const assignment = await requestQuoteRevision(params.id, body.reason);

      sendRevisionRequestToCollaborator({
        collaboratorName: assignment.collaborator.fullName,
        collaboratorEmail: assignment.collaborator.email,
        orderReference: assignment.order.reference,
        previousPriceCents: assignment.quotedPriceCents || 0,
        reason: body.reason,
        accessToken: assignment.accessToken,
      }).catch((err) => {
        console.error("[collaborator-assignment] revision request email failed", err);
      });

      await prisma.orderEvent.create({
        data: {
          orderId: assignment.order.id,
          type: "collaborator.quote.revision_requested",
          message: `Revisión de presupuesto solicitada a ${assignment.collaborator.fullName}.`,
          payload: {
            assignmentId: assignment.id,
            reason: body.reason || null,
            actorEmail: staff.email,
          },
        },
      });

      return NextResponse.json({ ok: true, assignment });
    }

    if (body.action === "accept") {
      const assignment = await acceptCollaboratorQuote(params.id);

      const priceCents = assignment.quotedPriceCents;
      if (!priceCents || priceCents <= 0) {
        return NextResponse.json(
          { ok: false, error: "El colaborador aún no ha enviado presupuesto válido." },
          { status: 400 }
        );
      }

      // Send acceptance email (con la fecha de entrega comprometida, igual que select-bid)
      sendAcceptanceToCollaborator({
        collaboratorName: assignment.collaborator.fullName,
        collaboratorEmail: assignment.collaborator.email,
        orderReference: assignment.order.reference,
        priceCents,
        accessToken: assignment.accessToken,
        dueDate: assignment.quotedDeadline,
      }).catch((err) => {
        console.error("[collaborator-assignment] acceptance email failed", err);
      });

      // Audit + pricing (margen+IVA) + finanzas — compartido con select-bid de Fase 2.
      await applyAcceptedQuoteSideEffects(prisma, {
        order: {
          id: assignment.order.id,
          amountCents: assignment.order.amountCents,
          paymentStatus: assignment.order.paymentStatus,
          marginPct: assignment.order.marginPct,
        },
        assignmentId: assignment.id,
        supplierCostCents: priceCents, // el colaborador cotiza SIN IVA
        quotedDeadline: assignment.quotedDeadline,
        collaborator: assignment.collaborator,
        actorEmail: staff.email,
        isWinning: true,
      });

      return NextResponse.json({ ok: true, assignment });
    }

    // Reject
    const assignment = await rejectCollaboratorQuote(params.id, body.reason);

    // Send rejection email to collaborator
    sendRejectionToCollaborator({
      collaboratorName: assignment.collaborator.fullName,
      collaboratorEmail: assignment.collaborator.email,
      orderReference: assignment.order.reference,
      reason: body.reason,
    }).catch((err) => {
      console.error("[collaborator-assignment] rejection email failed", err);
    });

    await prisma.orderEvent.create({
      data: {
        orderId: assignment.order.id,
        type: "collaborator.quote.rejected",
        message: `Presupuesto de ${assignment.collaborator.fullName} rechazado.`,
        payload: {
          assignmentId: assignment.id,
          reason: body.reason || null,
          actorEmail: staff.email,
        },
      },
    });

    return NextResponse.json({ ok: true, assignment });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json(
        { ok: false, error: "Encargo no encontrado o estado no válido." },
        { status: 404 }
      );
    }
    console.error("[collaborator-assignment] action error", err);
    return NextResponse.json(
      { ok: false, error: "Error al procesar la acción." },
      { status: 500 }
    );
  }
}
