import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { acceptCollaboratorQuote, rejectCollaboratorQuote, getDocumentsFromOrder } from "@/lib/collaborators";
import { sendAcceptanceToCollaborator, sendAssignmentToCollaborator, sendRejectionToCollaborator } from "@/lib/collaborator-emails";

export const runtime = "nodejs";

type Params = { params: { reference: string; id: string } };

type ActionBody = {
  action: "accept" | "reject" | "resend-email";
  reason?: string;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json()) as ActionBody;
    if (!["accept", "reject", "resend-email"].includes(body.action)) {
      return NextResponse.json({ ok: false, error: "action debe ser 'accept', 'reject' o 'resend-email'." }, { status: 400 });
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

    if (body.action === "accept") {
      const assignment = await acceptCollaboratorQuote(params.id);

      const priceCents = assignment.quotedPriceCents;
      if (!priceCents || priceCents <= 0) {
        return NextResponse.json(
          { ok: false, error: "El colaborador aún no ha enviado presupuesto válido." },
          { status: 400 }
        );
      }

      // Send acceptance email
      sendAcceptanceToCollaborator({
        collaboratorName: assignment.collaborator.fullName,
        collaboratorEmail: assignment.collaborator.email,
        orderReference: assignment.order.reference,
        priceCents,
        accessToken: assignment.accessToken,
      }).catch((err) => {
        console.error("[collaborator-assignment] acceptance email failed", err);
      });

      // Audit event
      await prisma.orderEvent.create({
        data: {
          orderId: assignment.order.id,
          type: "collaborator.quote.accepted",
          message: `Presupuesto de ${assignment.collaborator.fullName} aceptado: ${(priceCents / 100).toFixed(2)}€.`,
          payload: {
            assignmentId: assignment.id,
            priceCents,
            actorEmail: staff.email,
          },
        },
      });

      // Finance integration: create supplier invoice event
      const supplierName = assignment.collaborator.companyName || assignment.collaborator.fullName;
      const isAutonomo = assignment.collaborator.supplierType === "AUTONOMO";

      await prisma.orderEvent.create({
        data: {
          orderId: assignment.order.id,
          type: "finance.supplier_invoice.updated",
          message: `Factura proveedor auto-generada: ${supplierName} - ${(priceCents / 100).toFixed(2)}€.`,
          payload: {
            supplierName,
            supplierType: assignment.collaborator.supplierType,
            totalCents: priceCents,
            status: "PENDING_REQUEST",
            irpfRetentionPct: isAutonomo ? 15 : 0,
          },
        },
      });

      // Finance margin snapshot + negative margin warning
      const revenueCents = assignment.order.amountCents;
      const margin = revenueCents - priceCents;
      if (margin < 0) {
        console.warn(
          `[MARGEN NEGATIVO] Assignment ${assignment.id}: coste ${priceCents}¢ > ingreso ${revenueCents}¢`
        );
      }

      await prisma.orderEvent.create({
        data: {
          orderId: assignment.order.id,
          type: "finance.margin.snapshot",
          message: `Snapshot de margen: coste ${(priceCents / 100).toFixed(2)}€ vs ingreso ${(revenueCents / 100).toFixed(2)}€.`,
          payload: {
            supplierCostCents: priceCents,
            revenueCents,
          },
        },
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
