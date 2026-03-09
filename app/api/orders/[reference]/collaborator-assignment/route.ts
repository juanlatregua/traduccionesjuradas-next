import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { createAssignment, getDocumentsFromOrder } from "@/lib/collaborators";
import { sendAssignmentToCollaborator } from "@/lib/collaborator-emails";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type CreateBody = {
  collaboratorId: string;
  adminNotes?: string;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        reference: true,
        title: true,
        langPair: true,
        events: {
          where: {
            type: { in: ["presupuesto.submitted", "order.source_document_uploaded"] },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as CreateBody;
    if (!body.collaboratorId?.trim()) {
      return NextResponse.json({ ok: false, error: "collaboratorId es obligatorio." }, { status: 400 });
    }

    const collaborator = await prisma.collaborator.findUnique({
      where: { id: body.collaboratorId.trim() },
      select: { id: true },
    });
    if (!collaborator) {
      return NextResponse.json({ ok: false, error: "Colaborador no encontrado." }, { status: 404 });
    }

    const assignment = await createAssignment(
      order.id,
      body.collaboratorId.trim(),
      body.adminNotes
    );

    const documents = getDocumentsFromOrder(order);

    // Send email to collaborator
    sendAssignmentToCollaborator({
      collaboratorName: assignment.collaborator.fullName,
      collaboratorEmail: assignment.collaborator.email,
      orderReference: order.reference,
      orderTitle: order.title,
      langPair: order.langPair,
      accessToken: assignment.accessToken,
      adminNotes: body.adminNotes,
      documents,
    }).catch((err) => {
      console.error("[collaborator-assignment] email send failed", err);
    });

    // Audit event
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "collaborator.assignment.requested",
        message: `Encargo enviado a ${assignment.collaborator.fullName} (${assignment.collaborator.email}).`,
        payload: {
          collaboratorId: assignment.collaborator.id,
          name: assignment.collaborator.fullName,
          email: assignment.collaborator.email,
          accessToken: assignment.accessToken,
          actorEmail: staff.email,
        },
      },
    });

    return NextResponse.json({ ok: true, assignment }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Este colaborador ya tiene un encargo para este pedido." },
        { status: 409 }
      );
    }
    console.error("[collaborator-assignment] create error", err);
    return NextResponse.json(
      { ok: false, error: "Error al crear encargo." },
      { status: 500 }
    );
  }
}
