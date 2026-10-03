import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { applyAcceptedQuoteSideEffects, createAssignment, getDocumentsFromOrder } from "@/lib/collaborators";
import { notifyClientTranslationStarted } from "@/lib/orders";
import { retireLavoriForOutsideAssignment } from "@/lib/lavori-retire";
import { sendAssignmentToCollaborator } from "@/lib/collaborator-emails";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type CreateBody = {
  collaboratorId: string;
  adminNotes?: string;
  // Precio ya pactado con el traductor fuera del sistema (WhatsApp, teléfono), en
  // céntimos y SIN IVA: asigna directamente, sin pedirle cotización (Juan, 2-oct-2026,
  // 26_D8C6F8). Solo con el pedido pagado: el precio al cliente ya está cobrado.
  agreedPriceCents?: number;
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
        quoteId: true,
        amountCents: true,
        paymentStatus: true,
        marginPct: true,
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
      select: { id: true, fullName: true, companyName: true, supplierType: true, swornNumber: true },
    });
    if (!collaborator) {
      return NextResponse.json({ ok: false, error: "Colaborador no encontrado." }, { status: 404 });
    }

    const agreed = body.agreedPriceCents == null ? null : Math.round(Number(body.agreedPriceCents));
    if (agreed !== null) {
      if (!Number.isFinite(agreed) || agreed <= 0) {
        return NextResponse.json({ ok: false, error: "Precio pactado no válido." }, { status: 400 });
      }
      if (order.paymentStatus !== "PAID") {
        return NextResponse.json({ ok: false, error: "El pedido aún no está pagado: pide precio con «Enviar encargo» o espera al cobro." }, { status: 400 });
      }
      const yaAceptado = await prisma.collaboratorAssignment.findFirst({
        where: { orderId: order.id, status: { in: ["ACCEPTED", "DELIVERED"] } },
        select: { collaborator: { select: { fullName: true } } },
      });
      if (yaAceptado) {
        return NextResponse.json({ ok: false, error: `El pedido ya está asignado a ${yaAceptado.collaborator.fullName}. Cambiar de traductor un pedido ya aceptado no se hace desde aquí (de momento, a mano por Claude).` }, { status: 409 });
      }
      // Upsert: lo normal es que ya le hubieras pedido precio (fila REQUESTED/QUOTED).
      const now = new Date();
      const assignment = await prisma.collaboratorAssignment.upsert({
        where: { orderId_collaboratorId: { orderId: order.id, collaboratorId: collaborator.id } },
        create: { orderId: order.id, collaboratorId: collaborator.id, adminNotes: body.adminNotes || null, status: "ACCEPTED", isWinning: true, quotedPriceCents: agreed, quotedAt: now, acceptedAt: now },
        update: { status: "ACCEPTED", isWinning: true, quotedPriceCents: agreed, quotedAt: now, acceptedAt: now, rejectedAt: null, rejectionReason: null },
        include: { collaborator: true },
      });
      await prisma.collaboratorAssignment.updateMany({
        where: { orderId: order.id, id: { not: assignment.id }, status: { in: ["REQUESTED", "QUOTED", "QUOTE_REVISION_REQUESTED"] } },
        data: { status: "REJECTED", isWinning: false, rejectedAt: now, rejectionReason: "Asignado con precio pactado a otro traductor." },
      });
      const sideFx = await applyAcceptedQuoteSideEffects(prisma, {
        order: { id: order.id, amountCents: order.amountCents, paymentStatus: order.paymentStatus, marginPct: order.marginPct },
        assignmentId: assignment.id,
        supplierCostCents: agreed,
        collaborator,
        actorEmail: staff.email,
        isWinning: true,
      });
      if (sideFx.marginAlert) await sideFx.marginAlert();
      await prisma.order.update({ where: { id: order.id }, data: { assignedTo: collaborator.fullName } });
      // Lo que siga vivo en lavori para este pedido se retira (contrato 3-oct, paso 4).
      const lavori = await retireLavoriForOutsideAssignment({
        order: { id: order.id, reference: order.reference, quoteId: order.quoteId },
        collaboratorEmail: assignment.collaborator.email,
        actorEmail: staff.email,
      }).catch((err) => ({ retiradas: [] as string[], fallidas: [{ ref: "lavori", error: String(err?.message || err) }] }));
      const fallo = lavori.fallidas.map((f) => `${f.ref} (${f.error})`).join("; ");
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "collaborator.assignment.direct",
          message: `Asignado a ${collaborator.fullName} con precio ya pactado (${(agreed / 100).toFixed(2)} € sin IVA).${lavori.retiradas.length ? ` Retirado en lavori: ${lavori.retiradas.join(", ")}.` : ""}${fallo ? ` OJO: no se pudo retirar en lavori ${fallo}; resuélvelo a mano.` : ""}`,
          payload: { assignmentId: assignment.id, priceCents: agreed, actorEmail: staff.email, lavoriRetiradas: lavori.retiradas, lavoriFallidas: lavori.fallidas },
        },
      });
      await notifyClientTranslationStarted({
        reference: order.reference,
        translatorName: collaborator.fullName,
        swornNumber: collaborator.swornNumber,
        actorEmail: staff.email,
      }).catch((err) => console.error("[collaborator-assignment] client notify failed", err));
      sendAssignmentToCollaborator({
        collaboratorName: assignment.collaborator.fullName,
        collaboratorEmail: assignment.collaborator.email,
        orderReference: order.reference,
        orderTitle: order.title,
        langPair: order.langPair,
        accessToken: assignment.accessToken,
        adminNotes: [`Precio acordado: ${(agreed / 100).toFixed(2)} € (sin IVA).`, body.adminNotes].filter(Boolean).join(" "),
        documents: getDocumentsFromOrder(order),
      }).catch((err) => console.error("[collaborator-assignment] email send failed", err));
      return NextResponse.json(
        { ok: true, assignment, aviso: fallo ? `No se pudo retirar en lavori ${fallo}: resuélvelo a mano para que nadie más la acepte.` : null, lavoriRetiradas: lavori.retiradas },
        { status: 201 }
      );
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
