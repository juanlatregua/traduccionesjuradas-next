import { NextResponse } from "next/server";
import { confirmManualPaymentWithSideEffects } from "@/lib/payments-confirm";
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

    const result = await confirmManualPaymentWithSideEffects(params.reference, method, actorEmail);
    if (!result.changed) {
      return NextResponse.json({
        ok: true,
        alreadyPaid: true,
        duplicate: result.duplicate,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[confirm-payment] error", err);
    return NextResponse.json({ ok: false, error: "Error al confirmar pago." }, { status: 500 });
  }
}
