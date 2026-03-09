import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { acceptCollaboratorQuote, rejectCollaboratorQuote } from "@/lib/collaborators";
import { sendAcceptanceToCollaborator } from "@/lib/collaborator-emails";

export const runtime = "nodejs";

type Params = { params: { reference: string; id: string } };

type ActionBody = {
  action: "accept" | "reject";
  reason?: string;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json()) as ActionBody;
    if (!["accept", "reject"].includes(body.action)) {
      return NextResponse.json({ ok: false, error: "action debe ser 'accept' o 'reject'." }, { status: 400 });
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
