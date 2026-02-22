import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { confirmManualPayment, getOrderDetail } from "@/lib/orders";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import { assignDefaultFrenchEtaIfNeeded, transitionWorkflowState } from "@/lib/workflow-server";
import { prisma } from "@/lib/prisma";
import { getWorkflowState } from "@/lib/workflow";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type ConfirmBody = {
  method?: "BIZUM" | "TRANSFER";
};

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isStaffEmail(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Acceso denegado." }, { status: 403 });
  }

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

    const paymentUpdate = await confirmManualPayment(params.reference, method);
    if (!paymentUpdate.changed) {
      return NextResponse.json({ ok: true, alreadyPaid: true });
    }

    await transitionWorkflowState({
      reference: params.reference,
      to: "PAGO_VALIDADO",
      actorEmail: session.user.email,
      reason: `Pago manual validado (${method}).`,
    });
    await assignDefaultFrenchEtaIfNeeded({
      reference: params.reference,
      actorEmail: session.user.email,
    }).catch((err) => {
      console.error("[confirm-payment] default FR ETA assignment failed", err);
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
      }).catch((e) => console.error("[confirm-payment] email failed", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[confirm-payment] error", err);
    return NextResponse.json({ ok: false, error: "Error al confirmar pago." }, { status: 500 });
  }
}
