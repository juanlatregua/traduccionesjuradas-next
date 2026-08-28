import { NextResponse } from "next/server";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { prisma } from "@/lib/prisma";
import { sendOrderCreatedEmail } from "@/lib/email";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { WORKFLOW_STATES, type WorkflowState } from "@/lib/workflow";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type Body = {
  to?: WorkflowState;
  reason?: string;
  notifyClient?: boolean;
  // Entrega YA hecha fuera de la app (correo propio, en mano, papel): registra
  // el hecho sin exigir fichero y sin avisar al cliente. Exige motivo.
  deliveredOutsideApp?: boolean;
};

function isWorkflowState(value: unknown): value is WorkflowState {
  return typeof value === "string" && (WORKFLOW_STATES as readonly string[]).includes(value);
}

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const body = (await req.json()) as Body;
    if (!isWorkflowState(body.to)) {
      return NextResponse.json({ ok: false, error: "Estado de workflow no valido." }, { status: 400 });
    }

    const outsideApp = body.deliveredOutsideApp === true && body.to === "TRADUCIDO_ENTREGADO";
    if (outsideApp && !body.reason) {
      return NextResponse.json(
        { ok: false, error: "Indica el motivo: se registra una entrega hecha fuera de la app." },
        { status: 400 }
      );
    }

    const transition = await transitionWorkflowState({
      reference: params.reference,
      to: body.to,
      actorEmail,
      reason: body.reason || null,
      ...(outsideApp ? { payload: { deliveredOutsideApp: true } } : {}),
    });
    let finalTo = transition.to;

    if (body.notifyClient && (body.to === "PRESUPUESTO_ENVIADO" || body.to === "PENDIENTE_PAGO")) {
      const order = await prisma.order.findUnique({
        where: { reference: params.reference },
        select: {
          reference: true,
          title: true,
          amountCents: true,
          clientEmail: true,
          clientName: true,
          clientLocale: true,
        },
      });
      if (order?.clientEmail) {
        const { buildSignedOrderUrl } = await import("@/lib/order-token");
        const paymentUrl = buildSignedOrderUrl(order.reference, "pagar");
        sendEmailWithRetry(() =>
          sendOrderCreatedEmail({
            toEmail: order.clientEmail,
            clientName: order.clientName || undefined,
            reference: order.reference,
            title: order.title,
            amountCents: order.amountCents,
            paymentUrl,
            lang: order.clientLocale === "fr" ? "fr" : "es",
          })
        ).catch((err) => console.error("[workflow-transition] client notify failed", err));
      }

      if (body.to === "PRESUPUESTO_ENVIADO") {
        const followUp = await transitionWorkflowState({
          reference: params.reference,
          to: "PENDIENTE_PAGO",
          actorEmail,
          reason: "Presupuesto notificado al cliente, se habilita pago.",
        }).catch((err) => {
          console.error("[workflow-transition] follow-up transition to PENDIENTE_PAGO failed", err);
          return null;
        });
        if (followUp?.to) {
          finalTo = followUp.to;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      changed: transition.changed,
      from: transition.from,
      to: finalTo,
    });
  } catch (err: any) {
    console.error("[workflow-transition] error", err);
    const message = String(err?.message || "No se pudo actualizar el workflow.");
    if (
      message.includes("Transicion no permitida") ||
      message.includes("PAGO_VALIDADO sin pago confirmado") ||
      message.includes("adjuntar al menos un archivo")
    ) {
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
