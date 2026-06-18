import { NextResponse } from "next/server";
import { verifyRedsysNotification } from "@/lib/redsys";
import { updateOrderPayment, markPaymentFailed, getOrderDetail } from "@/lib/orders";
import { sendPaymentConfirmedEmail, sendNewOrderStaffEmail } from "@/lib/email";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { isResponseCodeOk } from "redsys-easy";
import { assignDefaultFrenchEtaIfNeeded, autoAssignCollaboratorIfNeeded, transitionWorkflowState } from "@/lib/workflow-server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const Ds_SignatureVersion = formData.get("Ds_SignatureVersion") as string;
    const Ds_MerchantParameters = formData.get("Ds_MerchantParameters") as string;
    const Ds_Signature = formData.get("Ds_Signature") as string;

    if (!Ds_SignatureVersion || !Ds_MerchantParameters || !Ds_Signature) {
      return NextResponse.json({ ok: false, error: "Parametros incompletos." }, { status: 400 });
    }

    const decoded = verifyRedsysNotification({
      Ds_SignatureVersion,
      Ds_MerchantParameters,
      Ds_Signature,
    });

    // Recover original order reference from Ds_MerchantData
    const orderReference = decoded.Ds_MerchantData as string;
    const responseCode = decoded.Ds_Response as string;
    const authCode = decoded.Ds_AuthorisationCode as string;
    const dsOrder = decoded.Ds_Order as string;

    if (!orderReference) {
      console.error("[redsys-notification] no order reference in Ds_MerchantData");
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (isResponseCodeOk(responseCode)) {
      const providerEventId = `${String(dsOrder || orderReference || "").trim()}:${String(authCode || responseCode || "").trim()}`;
      const paymentUpdate = await updateOrderPayment(orderReference, "REDSYS", providerEventId, {
        source: "redsys_notification",
        payload: {
          responseCode: String(responseCode || ""),
          authCode: String(authCode || ""),
          dsOrder: String(dsOrder || ""),
        },
      });
      if (!paymentUpdate.changed) {
        return NextResponse.json({ ok: true, duplicate: true, alreadyPaid: paymentUpdate.alreadyPaid });
      }
      await transitionWorkflowState({
        reference: orderReference,
        to: "PAGO_VALIDADO",
        actorEmail: "redsys_notification",
        reason: "Pago confirmado por Redsys.",
      }).catch((err) => console.error("[redsys-notification] workflow transition failed", err));
      await assignDefaultFrenchEtaIfNeeded({
        reference: orderReference,
        actorEmail: "redsys_notification",
      }).catch((err) => console.error("[redsys-notification] default FR ETA assignment failed", err));

      await autoAssignCollaboratorIfNeeded({
        reference: orderReference,
        actorEmail: "redsys_notification",
      }).catch((err) => console.error("[redsys-notification] auto collaborator assignment failed", err));
      console.info(`[redsys-notification] payment OK for ${orderReference}`);

      // Notify client (non-blocking)
      const order = await getOrderDetail(orderReference);

      // Aviso a staff — toda vía de pago debe avisar (antes Redsys no lo hacía).
      if (order) {
        sendEmailWithRetry(() =>
          sendNewOrderStaffEmail({
            reference: order.reference,
            title: order.title,
            amountCents: order.amountCents,
            clientEmail: order.clientEmail,
            langPair: order.langPair || undefined,
          })
        ).catch((e) => console.error("[redsys-notification] staff new-order email failed", e));

        void import("@/lib/sms")
          .then(({ sendStaffNewOrderSMS }) =>
            sendStaffNewOrderSMS({
              reference: order.reference,
              amountCents: order.amountCents,
              langPair: order.langPair,
              via: "Redsys",
            })
          )
          .catch((e) => console.error("[redsys-notification] staff payment SMS failed", e));
      }

      if (order?.clientEmail) {
        sendEmailWithRetry(() =>
          sendPaymentConfirmedEmail({
            toEmail: order.clientEmail,
            reference: order.reference,
            title: order.title,
            amountCents: order.amountCents,
            method: "REDSYS",
            lang: order.clientLocale === "fr" ? "fr" : "es",
          })
        ).catch((e) => console.error("[redsys-notification] email failed", e));

        // SMS notification (fire & forget)
        const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
        const { smsPagoConfirmado } = await import("@/lib/sms-templates");
        const { buildSignedOrderUrl } = await import("@/lib/order-token");
        const { formatDeliveryPlazo } = await import("@/lib/sms-templates");
        const orderFull = await prisma.order.findUnique({
          where: { reference: orderReference },
          select: { id: true, dueDate: true, clientLocale: true },
        });
        if (orderFull) {
          const phone = await getOrderPhone(orderFull.id).catch(() => null);
          if (phone) {
            const lang = orderFull.clientLocale === "fr" ? "fr" : "es";
            const plazo = formatDeliveryPlazo(orderFull.dueDate, lang);
            const url = buildSignedOrderUrl(orderReference, "estado");
            sendNotification({
              to: formatPhoneSpain(phone),
              body: smsPagoConfirmado({ ref: orderReference, plazo, url, lang }),
              whatsapp: { key: "pago", lang, vars: [orderReference, plazo, url] },
            }).catch((err) => console.error("[redsys-notification] SMS failed", err));
          }
        }
      }
    } else {
      await markPaymentFailed(orderReference);
      console.warn(`[redsys-notification] payment FAILED for ${orderReference}, code: ${responseCode}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[redsys-notification] error processing notification", err);
    return NextResponse.json({ ok: false, error: "Error procesando notificacion." }, { status: 500 });
  }
}
