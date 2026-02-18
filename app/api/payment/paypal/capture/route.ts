import { NextResponse } from "next/server";
import { capturePayPalOrder } from "@/lib/paypal";
import { updateOrderPayment } from "@/lib/orders";

export const runtime = "nodejs";

type CaptureBody = {
  paypalOrderId?: string;
  reference?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CaptureBody;

    if (!body.paypalOrderId || !body.reference) {
      return NextResponse.json(
        { ok: false, error: "paypalOrderId y reference requeridos." },
        { status: 400 }
      );
    }

    const captured = await capturePayPalOrder(body.paypalOrderId);

    if (captured.status === "COMPLETED") {
      const captureId =
        captured.purchase_units?.[0]?.payments?.captures?.[0]?.id || body.paypalOrderId;

      await updateOrderPayment(body.reference, "PAYPAL", captureId);

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
