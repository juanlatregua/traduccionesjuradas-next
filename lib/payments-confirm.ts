// lib/payments-confirm.ts — Efectos de confirmar un pago manual, en UN solo sitio.
// Lo usan tanto el endpoint de staff (/confirm-payment) como la auto-confirmacion
// de clientes de confianza al subir justificante (/payment-proof). Antes esta
// logica vivia inline en /confirm-payment; extraerla evita que los dos caminos
// diverjan (mismo PAID + transicion + ETA + colaborador + email + SMS).
import { confirmManualPayment, getOrderDetail } from "@/lib/orders";
import { excludeFromBillingIfBizum } from "@/lib/billing-exclusion";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import {
  assignDefaultFrenchEtaIfNeeded,
  autoAssignCollaboratorIfNeeded,
  transitionWorkflowState,
} from "@/lib/workflow-server";
import { prisma } from "@/lib/prisma";

export async function confirmManualPaymentWithSideEffects(
  reference: string,
  method: "BIZUM" | "TRANSFER",
  actorEmail: string
): Promise<{ changed: boolean; duplicate?: boolean }> {
  const paymentUpdate = await confirmManualPayment(reference, method, actorEmail);
  if (!paymentUpdate.changed) {
    return { changed: false, duplicate: paymentUpdate.duplicate };
  }

  // Bizum ⇒ sin factura (regla Juan 21-ago-2026).
  {
    const o = await prisma.order.findUnique({ where: { reference }, select: { id: true } });
    if (o) await excludeFromBillingIfBizum(o.id, method).catch((e) => console.error("[confirm-payment] billing exclusion failed", e));
  }

  await transitionWorkflowState({
    reference,
    to: "PAGO_VALIDADO",
    actorEmail,
    reason: `Pago manual validado (${method}).`,
  });
  await assignDefaultFrenchEtaIfNeeded({ reference, actorEmail }).catch((err) => {
    console.error("[confirm-payment] default FR ETA assignment failed", err);
  });
  await autoAssignCollaboratorIfNeeded({ reference, actorEmail }).catch((err) => {
    console.error("[confirm-payment] auto collaborator assignment failed", err);
  });

  // Aviso al cliente (no bloqueante): email + SMS.
  const order = await getOrderDetail(reference);
  if (order?.clientEmail) {
    sendPaymentConfirmedEmail({
      toEmail: order.clientEmail,
      reference: order.reference,
      title: order.title,
      amountCents: order.amountCents,
      method,
      lang: order.clientLocale === "fr" ? "fr" : "es",
    }).catch((e) => console.error("[confirm-payment] email failed", e));

    const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
    const { smsPagoConfirmado, formatDeliveryPlazo } = await import("@/lib/sms-templates");
    const { buildSignedOrderUrl } = await import("@/lib/order-token");
    const orderFull = await prisma.order.findUnique({
      where: { reference },
      select: { id: true, dueDate: true, clientLocale: true },
    });
    if (orderFull) {
      const phone = await getOrderPhone(orderFull.id).catch(() => null);
      if (phone) {
        const lang = orderFull.clientLocale === "fr" ? "fr" : "es";
        sendNotification({
          to: formatPhoneSpain(phone),
          body: smsPagoConfirmado({
            ref: reference,
            plazo: formatDeliveryPlazo(orderFull.dueDate, lang),
            url: buildSignedOrderUrl(reference, "estado"),
            lang,
          }),
        }).catch((err) => console.error("[confirm-payment] SMS failed", err));
      }
    }
  }

  return { changed: true };
}
