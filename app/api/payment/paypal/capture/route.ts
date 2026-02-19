import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { capturePayPalOrder } from "@/lib/paypal";
import { getOrderDetail, updateOrderPayment } from "@/lib/orders";
import { sendPaymentConfirmedEmail } from "@/lib/email";

export const runtime = "nodejs";

type CaptureBody = {
  paypalOrderId?: string;
  reference?: string;
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
    }

    const body = (await req.json()) as CaptureBody;

    if (!body.paypalOrderId || !body.reference) {
      return NextResponse.json(
        { ok: false, error: "paypalOrderId y reference requeridos." },
        { status: 400 }
      );
    }

    const order = await getOrderDetail(body.reference, session.user.email);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const captured = await capturePayPalOrder(body.paypalOrderId);

    if (captured.status === "COMPLETED") {
      const captureId =
        captured.purchase_units?.[0]?.payments?.captures?.[0]?.id || body.paypalOrderId;

      await updateOrderPayment(body.reference, "PAYPAL", captureId);

      // Notify client (non-blocking)
      sendPaymentConfirmedEmail({
        toEmail: session.user.email,
        reference: order.reference,
        title: order.title,
        amountCents: order.amountCents,
        method: "PAYPAL",
      }).catch((e) => console.error("[paypal-capture] email failed", e));

      return NextResponse.json({ ok: true, status: "COMPLETED" });
    }

    return NextResponse.json({ ok: false, error: `Estado PayPal: ${captured.status}` }, { status: 400 });
  } catch (err: any) {
    console.error("[paypal-capture] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al capturar pago PayPal." },
      { status: 500 }
    );
  }
}
