import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignOrder, getOrderDetail } from "@/lib/orders";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getWorkflowState } from "@/lib/workflow";
import { findTranslatorProfile } from "@/lib/translators";
import { sendTranslationStartedAssignedEmail } from "@/lib/email";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type AssignBody = {
  assignedTo?: string | null;
  dueDate?: string | null;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const orderBefore = await getOrderDetail(params.reference);
    if (!orderBefore) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as AssignBody;
    const requestedAssignedTo = body.assignedTo?.trim() || null;
    const translatorProfile = findTranslatorProfile(requestedAssignedTo);
    const assignedTo = requestedAssignedTo
      ? translatorProfile?.fullName || requestedAssignedTo
      : null;
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;

    if (dueDate && isNaN(dueDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Fecha límite no válida." },
        { status: 400 }
      );
    }

    await assignOrder(params.reference, assignedTo, dueDate);

    const workflowBefore = getWorkflowState(orderBefore);
    if (assignedTo && orderBefore.paymentStatus === "PAID" && workflowBefore === "PAGO_VALIDADO") {
      await transitionWorkflowState({
        reference: params.reference,
        to: "EN_TRADUCCION",
        actorEmail,
        reason: "Asignacion de traductor y arranque operativo.",
      }).catch((err) => {
        console.error("[orders-assign] workflow transition failed", err);
      });
    }

    const shouldNotifyClient =
      !!assignedTo &&
      orderBefore.paymentStatus === "PAID" &&
      (orderBefore.assignedTo || "") !== assignedTo;

    if (shouldNotifyClient) {
      await sendTranslationStartedAssignedEmail({
        toEmail: orderBefore.clientEmail,
        reference: orderBefore.reference,
        translatorName: assignedTo!,
        translatorSwornNumber: translatorProfile?.swornNumber || null,
        etaDateLabel: dueDate ? dueDate.toLocaleDateString("es-ES") : null,
      }).catch((err) => {
        console.error("[orders-assign] client assign email failed", err);
      });

      await prisma.orderEvent.create({
        data: {
          orderId: orderBefore.id,
          type: "client.translation_started_notified",
          message: `Cliente notificado: traduccion en proceso asignada a ${assignedTo}.`,
          payload: {
            actorEmail,
            assignedTo,
            swornNumber: translatorProfile?.swornNumber || null,
            dueDate: dueDate ? dueDate.toISOString() : null,
          },
        },
      }).catch((err) => {
        console.error("[orders-assign] notification event failed", err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[orders-assign] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al asignar pedido." },
      { status: 500 }
    );
  }
}
