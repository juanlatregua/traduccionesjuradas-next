import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { acceptCollaboratorQuote, rejectCollaboratorQuote, requestQuoteRevision, getDocumentsFromOrder } from "@/lib/collaborators";
import { sendAcceptanceToCollaborator, sendAssignmentToCollaborator, sendRejectionToCollaborator, sendRevisionRequestToCollaborator } from "@/lib/collaborator-emails";
import { customerPriceFromSupplierCost, netFromGross, DEFAULT_COLLABORATOR_MARGIN_PCT } from "@/lib/quotes";

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

      // --- Precio al cliente, coste y plazo (Fase 1) ---
      const order = assignment.order;
      const supplierCostCents = priceCents; // el colaborador cotiza SIN IVA
      const marginPct = order.marginPct ?? DEFAULT_COLLABORATOR_MARGIN_PCT;
      const alreadyCharged = order.paymentStatus === "PAID";

      // Flujo competitivo (aún sin cobrar): el precio al cliente se deriva del coste.
      // Pedido ya pagado (flujo antiguo): se respeta el importe cobrado, solo se registra el coste.
      const customerPriceCents = alreadyCharged
        ? order.amountCents
        : customerPriceFromSupplierCost(supplierCostCents, marginPct);

      await prisma.order.update({
        where: { id: order.id },
        data: {
          supplierCostCents,
          marginPct,
          ...(alreadyCharged ? {} : { amountCents: customerPriceCents }),
          ...(assignment.quotedDeadline ? { dueDate: assignment.quotedDeadline } : {}),
        },
      });

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "order.pricing.calculated",
          message: `Precio cliente ${(customerPriceCents / 100).toFixed(2)}€ = coste ${(supplierCostCents / 100).toFixed(2)}€ × (1+${marginPct}%) + IVA${alreadyCharged ? " · pedido ya pagado, importe no modificado" : ""}.`,
          payload: {
            supplierCostCents,
            marginPct,
            customerPriceCents,
            alreadyCharged,
            dueDate: assignment.quotedDeadline || null,
            actorEmail: staff.email,
          },
        },
      });

      // Finance integration: create supplier invoice event (coste sin IVA)
      const supplierName = assignment.collaborator.companyName || assignment.collaborator.fullName;
      const isAutonomo = assignment.collaborator.supplierType === "AUTONOMO";

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "finance.supplier_invoice.updated",
          message: `Factura proveedor auto-generada: ${supplierName} - ${(supplierCostCents / 100).toFixed(2)}€.`,
          payload: {
            supplierName,
            supplierType: assignment.collaborator.supplierType,
            totalCents: supplierCostCents,
            status: "PENDING_REQUEST",
            irpfRetentionPct: isAutonomo ? 15 : 0,
          },
        },
      });

      // Snapshot de margen — comparar SIEMPRE neto de IVA (ingreso sin IVA vs coste sin IVA).
      // El IVA es repercutido (no es margen): antes se comparaba ingreso CON IVA contra coste SIN IVA.
      const revenueNetCents = netFromGross(customerPriceCents);
      const marginCents = revenueNetCents - supplierCostCents;
      if (marginCents < 0) {
        console.warn(
          `[MARGEN NEGATIVO] Assignment ${assignment.id}: coste ${supplierCostCents}¢ > ingreso neto ${revenueNetCents}¢`
        );
      }

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "finance.margin.snapshot",
          message: `Snapshot de margen: ingreso neto ${(revenueNetCents / 100).toFixed(2)}€ − coste ${(supplierCostCents / 100).toFixed(2)}€ = ${(marginCents / 100).toFixed(2)}€.`,
          payload: {
            supplierCostCents,
            revenueCents: revenueNetCents,
            grossRevenueCents: customerPriceCents,
            marginCents,
            marginBasis: "net_of_vat",
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
