import { NextResponse } from "next/server";
import { confirmManualPayment, getOrderDetail } from "@/lib/orders";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import { assignDefaultFrenchEtaIfNeeded, autoAssignCollaboratorIfNeeded, transitionWorkflowState } from "@/lib/workflow-server";
import { prisma } from "@/lib/prisma";
import { getWorkflowState } from "@/lib/workflow";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type ConfirmBody = {
  method?: "BIZUM" | "TRANSFER";
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const body = (await req.json()) as ConfirmBody;
    const method = body.method === "TRANSFER" ? "TRANSFER" : "BIZUM";
    const orderBefore = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        paymentStatus: true,
        deliveryState: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            type: true,
            payload: true,
            createdAt: true,
          },
        },
      },
    });
    if (!orderBefore) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const workflowState = getWorkflowState(orderBefore);
    if (!["PENDIENTE_PAGO", "JUSTIFICANTE_SUBIDO", "PRESUPUESTO_ENVIADO"].includes(workflowState)) {
      return NextResponse.json(
        {
          ok: false,
          error: "No se puede validar pago en este estado operativo.",
        },
        { status: 400 }
      );
    }

    const paymentUpdate = await confirmManualPayment(params.reference, method, actorEmail);
    if (!paymentUpdate.changed) {
      return NextResponse.json({
        ok: true,
        alreadyPaid: true,
        duplicate: paymentUpdate.duplicate,
      });
    }

    await transitionWorkflowState({
      reference: params.reference,
      to: "PAGO_VALIDADO",
      actorEmail,
      reason: `Pago manual validado (${method}).`,
    });
    await assignDefaultFrenchEtaIfNeeded({
      reference: params.reference,
      actorEmail,
    }).catch((err) => {
      console.error("[confirm-payment] default FR ETA assignment failed", err);
    });

    await autoAssignCollaboratorIfNeeded({
      reference: params.reference,
      actorEmail,
    }).catch((err) => {
      console.error("[confirm-payment] auto collaborator assignment failed", err);
    });

    // Notify client (non-blocking)
    const order = await getOrderDetail(params.reference);
    if (order?.clientEmail) {
      sendPaymentConfirmedEmail({
        toEmail: order.clientEmail,
        reference: order.reference,
        title: order.title,
        amountCents: order.amountCents,
        method,
        lang: order.clientLocale === "fr" ? "fr" : "es",
      }).catch((e) => console.error("[confirm-payment] email failed", e));

      // SMS notification (fire & forget)
      const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
      const { smsPagoConfirmado } = await import("@/lib/sms-templates");
      const { buildSignedOrderUrl } = await import("@/lib/order-token");
      const { formatDeliveryPlazo } = await import("@/lib/sms-templates");
      const orderFull = await prisma.order.findUnique({
        where: { reference: params.reference },
        select: { id: true, dueDate: true, clientLocale: true },
      });
      if (orderFull) {
        const phone = await getOrderPhone(orderFull.id).catch(() => null);
        if (phone) {
          const lang = orderFull.clientLocale === "fr" ? "fr" : "es";
          sendNotification({
            to: formatPhoneSpain(phone),
            body: smsPagoConfirmado({ ref: params.reference, plazo: formatDeliveryPlazo(orderFull.dueDate, lang), url: buildSignedOrderUrl(params.reference, "estado"), lang }),
          }).catch((err) => console.error("[confirm-payment] SMS failed", err));
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[confirm-payment] error", err);
    return NextResponse.json({ ok: false, error: "Error al confirmar pago." }, { status: 500 });
  }
}
