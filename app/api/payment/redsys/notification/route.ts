import { NextResponse } from "next/server";
import { verifyRedsysNotification } from "@/lib/redsys";
import { updateOrderPayment, markPaymentFailed, getOrderDetail } from "@/lib/orders";
import { sendPaymentConfirmedEmail } from "@/lib/email";
import { isResponseCodeOk } from "redsys-easy";

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

    if (!orderReference) {
      console.error("[redsys-notification] no order reference in Ds_MerchantData");
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    if (isResponseCodeOk(responseCode)) {
      await updateOrderPayment(orderReference, "REDSYS", authCode || responseCode);
      console.info(`[redsys-notification] payment OK for ${orderReference}`);

      // Notify client (non-blocking)
      const order = await getOrderDetail(orderReference);
      if (order?.clientEmail) {
        sendPaymentConfirmedEmail({
          toEmail: order.clientEmail,
          reference: order.reference,
          title: order.title,
          amountCents: order.amountCents,
          method: "REDSYS",
        }).catch((e) => console.error("[redsys-notification] email failed", e));
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
